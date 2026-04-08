'use client'
import React, { useState, useEffect } from 'react'

interface LedgerEntry {
  amount: number
  type: string
  description: string
  created_at: string
}

interface TrustData {
  balance: number
  lifetime: number
  lastUpdated: string | null
  recentActivity: LedgerEntry[]
}

const MOCK_TRANSACTIONS = [
  { id: 1, type: 'earned', desc: 'Service sold: Brand Identity Design', amount: 405, date: '7 Apr 2025', from: 'Tom Walsh' },
  { id: 2, type: 'spent', desc: 'Service purchased: SEO Audit', amount: -320, date: '5 Apr 2025', from: 'Marcus Obi' },
  { id: 3, type: 'earned', desc: 'Product sold: Figma UI Kit', amount: 49, date: '4 Apr 2025', from: 'Yuki Tanaka' },
  { id: 4, type: 'impact', desc: 'Impact Fund contribution (1%)', amount: -4.54, date: '4 Apr 2025', from: 'Auto' },
  { id: 5, type: 'earned', desc: 'Referral reward: 2 new members', amount: 20, date: '2 Apr 2025', from: 'FreeTrust' },
  { id: 6, type: 'earned', desc: 'Service sold: UX Review', amount: 280, date: '1 Apr 2025', from: 'Lena Fischer' },
  { id: 7, type: 'spent', desc: 'Event ticket: Founder Summit', amount: 0, date: '29 Mar 2025', from: 'Events' },
  { id: 8, type: 'spent', desc: 'Community subscription: Impact Investors Forum', amount: -29, date: '1 Mar 2025', from: 'Community' },
]

function getTrustLevel(balance: number): { label: string; color: string } {
  if (balance >= 1000) return { label: 'Elite', color: '#fbbf24' }
  if (balance >= 500) return { label: 'Verified', color: '#34d399' }
  if (balance >= 100) return { label: 'Trusted', color: '#38bdf8' }
  return { label: 'Newcomer', color: '#94a3b8' }
}

function formatLedgerType(type: string): string {
  const labels: Record<string, string> = {
    signup_bonus: 'earned',
    article_published: 'earned',
    event_hosted: 'earned',
    platform_fee: 'impact',
    manual: 'earned',
  }
  return labels[type] ?? 'earned'
}

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState('All')
  const [trustData, setTrustData] = useState<TrustData | null>(null)
  const [loadingTrust, setLoadingTrust] = useState(true)

  useEffect(() => {
    fetch('/api/trust')
      .then(r => r.json())
      .then((data: TrustData) => {
        setTrustData(data)
      })
      .catch(() => {
        // Fall back to mock — trust system may not be configured yet
      })
      .finally(() => setLoadingTrust(false))
  }, [])

  // Use real ledger if available, else mock
  const realTransactions = trustData?.recentActivity?.map((entry, i) => ({
    id: i + 1000,
    type: formatLedgerType(entry.type),
    desc: entry.description ?? entry.type,
    amount: entry.amount,
    date: new Date(entry.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' }),
    from: 'FreeTrust',
  })) ?? []

  const transactions = realTransactions.length > 0 ? realTransactions : MOCK_TRANSACTIONS

  const filtered = activeTab === 'All' ? transactions
    : activeTab === 'Income' ? transactions.filter(t => t.type === 'earned')
    : activeTab === 'Spending' ? transactions.filter(t => t.type === 'spent')
    : transactions.filter(t => t.type === 'impact')

  const totalEarned = MOCK_TRANSACTIONS.filter(t => t.type === 'earned').reduce((s, t) => s + t.amount, 0)
  const totalSpent = Math.abs(MOCK_TRANSACTIONS.filter(t => t.type === 'spent').reduce((s, t) => s + t.amount, 0))
  const impactContributed = Math.abs(MOCK_TRANSACTIONS.filter(t => t.type === 'impact').reduce((s, t) => s + t.amount, 0))
  const balance = totalEarned - totalSpent - impactContributed

  const trustBalance = trustData?.balance ?? 0
  const trustLifetime = trustData?.lifetime ?? 0
  const trustLevel = getTrustLevel(trustBalance)

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .wallet-inner { max-width: 1000px; margin: 0 auto; padding: 2rem 1.5rem; }
        .wallet-grid3 { display: grid; grid-template-columns: repeat(3,1fr); gap: 1rem; margin-bottom: 1.5rem; }
        .wallet-balance-actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; flex-wrap: wrap; }
        .wallet-balance-actions button { padding: 0.6rem 1.4rem; border-radius: 8px; font-size: 0.88rem; font-weight: 700; cursor: pointer; border: none; }
        .wallet-trust-row { display: flex; align-items: center; gap: 1.5rem; }
        .wallet-tabs { display: flex; gap: 0.4rem; }
        .tx-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 1px solid rgba(56,189,248,0.08); flex-wrap: wrap; gap: 0.5rem; }

        @media (max-width: 768px) {
          .wallet-inner { padding: 1rem 1rem; }
          .wallet-grid3 { grid-template-columns: 1fr; }
          .wallet-balance-actions { flex-direction: column; }
          .wallet-balance-actions button { width: 100%; }
          .wallet-trust-row { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
          .wallet-tabs { flex-wrap: wrap; }
          .tx-header { flex-direction: column; align-items: flex-start; }
        }
      `}</style>

      <div className="wallet-inner">
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem' }}>My Wallet</h1>

        {/* Balance card */}
        <div style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.12),rgba(148,163,184,0.05))', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 16, padding: '2rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '0.5rem', letterSpacing: '0.05em', fontWeight: 600 }}>AVAILABLE BALANCE</div>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: '#f1f5f9', lineHeight: 1 }}>
            <span style={{ fontSize: '1.5rem', color: '#94a3b8', fontWeight: 400 }}>£</span>{balance.toFixed(2)}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' }}>FreeTrust account · Updated just now</div>
          <div className="wallet-balance-actions">
            <button style={{ background: '#38bdf8', color: '#0f172a' }}>Withdraw</button>
            <button style={{ background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)' }}>Add Funds</button>
            <button style={{ background: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.15)' }}>Send</button>
            <button style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>🌱 Donate to Impact</button>
          </div>
        </div>

        {/* Stats */}
        <div className="wallet-grid3">
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' }}>TOTAL EARNED</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>£{totalEarned.toFixed(2)}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>This month</div>
          </div>
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' }}>TOTAL SPENT</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9' }}>£{totalSpent.toFixed(2)}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>This month</div>
          </div>
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' }}>IMPACT CONTRIBUTED</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#34d399' }}>£{impactContributed.toFixed(2)}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>1% auto contribution</div>
          </div>
        </div>

        {/* Trust Score */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>TRUST ECONOMY</div>
          <div className="wallet-trust-row">
            <div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.25rem' }}>Trust Balance</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#38bdf8' }}>
                {loadingTrust ? '…' : `₮${trustBalance.toLocaleString()}`}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.25rem' }}>Lifetime Earned</div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#34d399' }}>
                {loadingTrust ? '…' : `₮${trustLifetime.toLocaleString()}`}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.4rem' }}>Level</div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: `${trustLevel.color}18`, border: `1px solid ${trustLevel.color}40`, borderRadius: 999, padding: '0.25rem 0.75rem' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: trustLevel.color, display: 'inline-block' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: trustLevel.color }}>{trustLevel.label}</span>
              </div>
              <div style={{ marginTop: '0.5rem', height: 6, background: 'rgba(56,189,248,0.1)', borderRadius: 3 }}>
                <div style={{ width: `${Math.min((trustBalance / 1000) * 100, 100)}%`, height: '100%', background: `linear-gradient(90deg,#38bdf8,${trustLevel.color})`, borderRadius: 3, transition: 'width 0.5s ease' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Transaction history */}
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden' }}>
          <div className="tx-header">
            <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>Transaction History</div>
            <div className="wallet-tabs">
              {['All', 'Income', 'Spending', 'Impact'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '0.3rem 0.7rem', borderRadius: 6, fontSize: '0.78rem', fontWeight: tab === activeTab ? 700 : 500, background: tab === activeTab ? 'rgba(56,189,248,0.1)' : 'transparent', border: `1px solid ${tab === activeTab ? 'rgba(56,189,248,0.3)' : 'transparent'}`, color: tab === activeTab ? '#38bdf8' : '#64748b', cursor: 'pointer' }}>{tab}</button>
              ))}
            </div>
          </div>
          {filtered.map((tx, i) => (
            <div key={`${tx.id}-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.25rem', borderBottom: '1px solid rgba(56,189,248,0.04)', gap: '1rem' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0, background: tx.type === 'earned' ? 'rgba(52,211,153,0.12)' : tx.type === 'impact' ? 'rgba(56,189,248,0.1)' : 'rgba(148,163,184,0.08)' }}>
                {tx.type === 'earned' ? '↓' : tx.type === 'impact' ? '🌱' : '↑'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 500, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tx.desc}</div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.15rem' }}>{tx.date} · {tx.from}</div>
              </div>
              <div style={{ fontSize: '1rem', fontWeight: 700, flexShrink: 0, color: tx.type === 'earned' ? '#34d399' : tx.type === 'impact' ? '#38bdf8' : '#94a3b8' }}>
                {tx.amount > 0 ? '+' : ''}£{Math.abs(tx.amount).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
