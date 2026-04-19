'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface MonthRow {
  month: number
  monthName: string
  orders: number
  grossCents: number
  feeCents: number
  netCents: number
}

interface InvoiceRow {
  id: string
  invoiceNumber: string | null
  date: string
  itemTitle: string
  buyerName: string
  grossCents: number
  feeCents: number
  netCents: number
  status: string
}

interface Summary {
  year: number
  monthly: MonthRow[]
  totals: {
    orders: number
    grossCents: number
    feeCents: number
    netCents: number
  }
  recentInvoices: InvoiceRow[]
}

function euro(cents: number) {
  return '€' + (cents / 100).toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })
}

const CURRENT_YEAR = new Date().getFullYear()
const CURRENT_MONTH = new Date().getMonth() + 1 // 1-indexed

export default function AccountingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [year, setYear] = useState(CURRENT_YEAR)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push('/login')
      } else {
        setAuthed(true)
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchSummary = useCallback(async (y: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/accounting/summary?year=${y}`)
      if (res.ok) setSummary(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authed) fetchSummary(year)
  }, [authed, year, fetchSummary])

  const exportCSV = (monthParam?: number) => {
    const url = monthParam
      ? `/api/accounting/export?year=${year}&month=${monthParam}`
      : `/api/accounting/export?year=${year}`
    window.open(url, '_blank')
  }

  const downloadInvoice = (orderId: string) => {
    window.open(`/api/orders/${orderId}/invoice`, '_blank')
  }

  if (authed === null) return null

  const years = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '1.5rem 1rem 6rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#f1f5f9' }}>📊 My Accounting</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>Sales records, invoices and CSV exports for your records</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{
              background: '#1e293b', border: '1px solid rgba(148,163,184,0.2)',
              color: '#f1f5f9', borderRadius: 8, padding: '0.5rem 0.75rem',
              fontSize: '0.9rem', cursor: 'pointer',
            }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => exportCSV()}
            style={{
              padding: '0.5rem 1rem', background: '#10b981', color: '#0f172a',
              border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem',
            }}
          >
            📥 Export Full Year CSV
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>Loading...</div>
      )}

      {!loading && summary && (
        <>
          {/* Summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Gross Sales', value: euro(summary.totals.grossCents), color: '#38bdf8', icon: '💰' },
              { label: 'Platform Fees', value: euro(summary.totals.feeCents), color: '#f87171', icon: '🏷' },
              { label: 'Net Earnings', value: euro(summary.totals.netCents), color: '#10b981', icon: '✅' },
              { label: 'Orders', value: String(summary.totals.orders), color: '#a78bfa', icon: '📦' },
            ].map(card => (
              <div key={card.label} style={{
                background: '#1e293b', borderRadius: 12, padding: '1rem',
                border: '1px solid rgba(148,163,184,0.1)',
              }}>
                <div style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>{card.icon}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Monthly breakdown */}
          <div style={{ background: '#1e293b', borderRadius: 14, border: '1px solid rgba(148,163,184,0.1)', marginBottom: '1.5rem', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>Monthly Breakdown — {year}</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                    {['Month', 'Orders', 'Gross', 'Fees', 'Net', 'Export'].map(h => (
                      <th key={h} style={{ padding: '0.75rem 1rem', textAlign: h === 'Export' ? 'center' : 'left', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summary.monthly.map(row => {
                    const isCurrent = row.month === CURRENT_MONTH && year === CURRENT_YEAR
                    return (
                      <tr
                        key={row.month}
                        style={{
                          borderBottom: '1px solid rgba(148,163,184,0.05)',
                          background: isCurrent ? 'rgba(16,185,129,0.05)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '0.65rem 1rem', color: isCurrent ? '#10b981' : '#f1f5f9', fontWeight: isCurrent ? 700 : 400 }}>
                          {row.monthName} {isCurrent ? '← current' : ''}
                        </td>
                        <td style={{ padding: '0.65rem 1rem', color: row.orders > 0 ? '#f1f5f9' : '#334155' }}>{row.orders}</td>
                        <td style={{ padding: '0.65rem 1rem', color: row.grossCents > 0 ? '#38bdf8' : '#334155' }}>{row.grossCents > 0 ? euro(row.grossCents) : '—'}</td>
                        <td style={{ padding: '0.65rem 1rem', color: row.feeCents > 0 ? '#f87171' : '#334155' }}>{row.feeCents > 0 ? euro(row.feeCents) : '—'}</td>
                        <td style={{ padding: '0.65rem 1rem', color: row.netCents > 0 ? '#10b981' : '#334155', fontWeight: row.netCents > 0 ? 700 : 400 }}>{row.netCents > 0 ? euro(row.netCents) : '—'}</td>
                        <td style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>
                          {row.orders > 0 ? (
                            <button
                              onClick={() => exportCSV(row.month)}
                              style={{
                                padding: '0.3rem 0.6rem', background: 'rgba(16,185,129,0.1)',
                                color: '#10b981', border: '1px solid rgba(16,185,129,0.25)', borderRadius: 6,
                                fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600,
                              }}
                            >
                              📥 CSV
                            </button>
                          ) : <span style={{ color: '#334155' }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent invoices */}
          <div style={{ background: '#1e293b', borderRadius: 14, border: '1px solid rgba(148,163,184,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f1f5f9' }}>Recent Invoices</h2>
            </div>
            {summary.recentInvoices.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
                No completed orders in {year} yet.{' '}
                <Link href="/browse" style={{ color: '#10b981' }}>Browse listings →</Link>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(148,163,184,0.08)' }}>
                      {['Invoice #', 'Date', 'Item', 'Buyer', 'Net', 'PDF'].map(h => (
                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: h === 'PDF' ? 'center' : 'left', color: '#64748b', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recentInvoices.map(inv => (
                      <tr key={inv.id} style={{ borderBottom: '1px solid rgba(148,163,184,0.05)' }}>
                        <td style={{ padding: '0.65rem 1rem', color: '#a78bfa', fontWeight: 600 }}>{inv.invoiceNumber ?? inv.id.slice(0, 8).toUpperCase()}</td>
                        <td style={{ padding: '0.65rem 1rem', color: '#94a3b8' }}>{formatDate(inv.date)}</td>
                        <td style={{ padding: '0.65rem 1rem', color: '#f1f5f9', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inv.itemTitle as string}</td>
                        <td style={{ padding: '0.65rem 1rem', color: '#94a3b8' }}>{inv.buyerName}</td>
                        <td style={{ padding: '0.65rem 1rem', color: '#10b981', fontWeight: 700 }}>{euro(inv.netCents)}</td>
                        <td style={{ padding: '0.65rem 1rem', textAlign: 'center' }}>
                          <button
                            onClick={() => downloadInvoice(inv.id)}
                            style={{
                              padding: '0.3rem 0.6rem', background: 'rgba(56,189,248,0.1)',
                              color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 6,
                              fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600,
                            }}
                          >
                            📄 PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
