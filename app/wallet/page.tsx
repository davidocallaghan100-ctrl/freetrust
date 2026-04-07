'use client'
import React, { useState } from 'react'

const transactions = [
  { id: 1, type: 'earned', desc: 'Service sold: Brand Identity Design', amount: 405, date: '7 Apr 2025', from: 'Tom Walsh' },
  { id: 2, type: 'spent', desc: 'Service purchased: SEO Audit', amount: -320, date: '5 Apr 2025', from: 'Marcus Obi' },
  { id: 3, type: 'earned', desc: 'Product sold: Figma UI Kit', amount: 49, date: '4 Apr 2025', from: 'Yuki Tanaka' },
  { id: 4, type: 'impact', desc: 'Impact Fund contribution (1%)', amount: -4.54, date: '4 Apr 2025', from: 'Auto' },
  { id: 5, type: 'earned', desc: 'Referral reward: 2 new members', amount: 20, date: '2 Apr 2025', from: 'FreeTrust' },
  { id: 6, type: 'earned', desc: 'Service sold: UX Review', amount: 280, date: '1 Apr 2025', from: 'Lena Fischer' },
  { id: 7, type: 'spent', desc: 'Event ticket: Founder Summit', amount: -0, date: '29 Mar 2025', from: 'Events' },
  { id: 8, type: 'spent', desc: 'Community subscription: Impact Investors Forum', amount: -29, date: '1 Mar 2025', from: 'Community' },
]

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  inner: { maxWidth: 1000, margin: '0 auto', padding: '2rem 1.5rem' },
  balanceCard: { background: 'linear-gradient(135deg,rgba(56,189,248,0.12),rgba(148,163,184,0.05))', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 16, padding: '2rem', marginBottom: '1.5rem' },
  balanceLabel: { fontSize: '0.82rem', color: '#64748b', marginBottom: '0.5rem', letterSpacing: '0.05em', fontWeight: 600 },
  balanceAmount: { fontSize: '3rem', fontWeight: 900, color: '#f1f5f9', lineHeight: 1 },
  balanceCurrency: { fontSize: '1.5rem', color: '#94a3b8', fontWeight: 400 },
  balanceMeta: { color: '#64748b', fontSize: '0.85rem', marginTop: '0.5rem' },
  balanceActions: { display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' },
  actionBtn: { padding: '0.6rem 1.4rem', borderRadius: 8, fontSize: '0.88rem', fontWeight: 700, cursor: 'pointer', border: 'none' },
  grid3: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1.5rem' },
  miniCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' },
  miniLabel: { fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem' },
  miniVal: { fontSize: '1.4rem', fontWeight: 800 },
  txList: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, overflow: 'hidden' },
  txHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid rgba(56,189,248,0.08)' },
  txTitle: { fontSize: '0.95rem', fontWeight: 700 },
  txRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.9rem 1.25rem', borderBottom: '1px solid rgba(56,189,248,0.04)', gap: '1rem' },
  txIcon: { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 },
  txInfo: { flex: 1 },
  txDesc: { fontSize: '0.88rem', fontWeight: 500, color: '#f1f5f9' },
  txMeta: { fontSize: '0.75rem', color: '#475569', marginTop: '0.15rem' },
  txAmount: { fontSize: '1rem', fontWeight: 700, flexShrink: 0 },
}

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState('All')

  const filtered = activeTab === 'All' ? transactions
    : activeTab === 'Income' ? transactions.filter(t => t.type === 'earned')
    : activeTab === 'Spending' ? transactions.filter(t => t.type === 'spent')
    : transactions.filter(t => t.type === 'impact')

  const totalEarned = transactions.filter(t => t.type === 'earned').reduce((s, t) => s + t.amount, 0)
  const totalSpent = Math.abs(transactions.filter(t => t.type === 'spent').reduce((s, t) => s + t.amount, 0))
  const impactContributed = Math.abs(transactions.filter(t => t.type === 'impact').reduce((s, t) => s + t.amount, 0))
  const balance = totalEarned - totalSpent - impactContributed

  return (
    <div style={S.page}>
      <div style={S.inner}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1.5rem' }}>My Wallet</h1>

        {/* Balance card */}
        <div style={S.balanceCard}>
          <div style={S.balanceLabel}>AVAILABLE BALANCE</div>
          <div style={S.balanceAmount}>
            <span style={S.balanceCurrency}>£</span>{balance.toFixed(2)}
          </div>
          <div style={S.balanceMeta}>FreeTrust account · Updated just now</div>
          <div style={S.balanceActions}>
            <button style={{ ...S.actionBtn, background: '#38bdf8', color: '#0f172a' }}>Withdraw</button>
            <button style={{ ...S.actionBtn, background: 'rgba(56,189,248,0.1)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.25)' }}>Add Funds</button>
            <button style={{ ...S.actionBtn, background: 'rgba(148,163,184,0.08)', color: '#94a3b8', border: '1px solid rgba(148,163,184,0.15)' }}>Send</button>
            <button style={{ ...S.actionBtn, background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>🌱 Donate to Impact</button>
          </div>
        </div>

        {/* Stats */}
        <div style={S.grid3}>
          <div style={S.miniCard}>
            <div style={S.miniLabel}>TOTAL EARNED</div>
            <div style={{ ...S.miniVal, color: '#34d399' }}>£{totalEarned.toFixed(2)}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>This month</div>
          </div>
          <div style={S.miniCard}>
            <div style={S.miniLabel}>TOTAL SPENT</div>
            <div style={{ ...S.miniVal, color: '#f1f5f9' }}>£{totalSpent.toFixed(2)}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>This month</div>
          </div>
          <div style={S.miniCard}>
            <div style={S.miniLabel}>IMPACT CONTRIBUTED</div>
            <div style={{ ...S.miniVal, color: '#34d399' }}>£{impactContributed.toFixed(2)}</div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>1% auto contribution</div>
          </div>
        </div>

        {/* Trust Score */}
        <div style={{ ...S.miniCard, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginBottom: '0.4rem', fontWeight: 600, letterSpacing: '0.05em' }}>TRUST SCORE</div>
            <div style={{ fontSize: '2rem', fontWeight: 900, color: '#38bdf8' }}>96 <span style={{ fontSize: '1rem', fontWeight: 400, color: '#64748b' }}>/ 100</span></div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ height: 8, background: 'rgba(56,189,248,0.1)', borderRadius: 4 }}>
              <div style={{ width: '96%', height: '100%', background: 'linear-gradient(90deg,#38bdf8,#34d399)', borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.4rem' }}>Excellent · 89 verified transactions · 12 5-star reviews</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Perks unlocked</div>
            <div style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 600 }}>0% withdrawal fee</div>
          </div>
        </div>

        {/* Transaction history */}
        <div style={S.txList}>
          <div style={S.txHeader}>
            <div style={S.txTitle}>Transaction History</div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {['All', 'Income', 'Spending', 'Impact'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{ padding: '0.3rem 0.7rem', borderRadius: 6, fontSize: '0.78rem', fontWeight: tab === activeTab ? 700 : 500, background: tab === activeTab ? 'rgba(56,189,248,0.1)' : 'transparent', border: `1px solid ${tab === activeTab ? 'rgba(56,189,248,0.3)' : 'transparent'}`, color: tab === activeTab ? '#38bdf8' : '#64748b', cursor: 'pointer' }}>{tab}</button>
              ))}
            </div>
          </div>
          {filtered.map(tx => (
            <div key={tx.id} style={S.txRow}>
              <div style={{
                ...S.txIcon,
                background: tx.type === 'earned' ? 'rgba(52,211,153,0.12)' : tx.type === 'impact' ? 'rgba(56,189,248,0.1)' : 'rgba(148,163,184,0.08)',
              }}>
                {tx.type === 'earned' ? '↓' : tx.type === 'impact' ? '🌱' : '↑'}
              </div>
              <div style={S.txInfo}>
                <div style={S.txDesc}>{tx.desc}</div>
                <div style={S.txMeta}>{tx.date} · {tx.from}</div>
              </div>
              <div style={{ ...S.txAmount, color: tx.type === 'earned' ? '#34d399' : tx.type === 'impact' ? '#38bdf8' : '#94a3b8' }}>
                {tx.amount > 0 ? '+' : ''}£{Math.abs(tx.amount).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
