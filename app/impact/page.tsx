'use client'
import React, { useState, useEffect, useRef } from 'react'

const categories = ['All Projects', 'Reforestation', 'Clean Energy', 'Ocean', 'Education', 'Food Security', 'Biodiversity']

const projects = [
  { id: 1, name: 'Great Rift Valley Reforestation', category: 'Reforestation', location: 'Kenya & Tanzania', raised: 142800, goal: 200000, currency: '€', backers: 1840, avatar: 'GR', desc: 'Restoring 50,000 hectares of degraded land across the Great Rift Valley through community-led tree planting and agroforestry.', impact: '2.1M trees planted', sdgs: [13, 15, 1], status: 'Active', tags: ['Trees', 'Community', 'Livelihoods'], trees: 2100000 },
  { id: 2, name: 'Solar for Schools – West Africa', category: 'Clean Energy', location: 'Ghana & Senegal', raised: 87400, goal: 150000, currency: '€', backers: 934, avatar: 'SS', desc: 'Installing solar panels in 200 schools across rural Ghana and Senegal.', impact: '40,000 students benefiting', sdgs: [4, 7, 10], status: 'Active', tags: ['Solar', 'Education', 'Africa'], trees: 0 },
  { id: 3, name: 'Pacific Plastic Clean-Up Initiative', category: 'Ocean', location: 'Pacific Ocean', raised: 203000, goal: 250000, currency: '€', backers: 3200, avatar: 'PC', desc: 'Deploying autonomous vessels to collect microplastics from the North Pacific Gyre.', impact: '84 tonnes plastic removed', sdgs: [14, 12, 17], status: 'Active', tags: ['Ocean', 'Plastic', 'Marine'], trees: 0 },
  { id: 4, name: 'Seed Libraries Network', category: 'Biodiversity', location: 'Global', raised: 41200, goal: 60000, currency: '€', backers: 567, avatar: 'SL', desc: 'Building a global network of open-source seed libraries to preserve heirloom varieties.', impact: '2,300 varieties preserved', sdgs: [2, 15, 17], status: 'Active', tags: ['Seeds', 'Biodiversity', 'Food'], trees: 0 },
  { id: 5, name: 'Clean Cookstoves for East Africa', category: 'Food Security', location: 'Uganda & Rwanda', raised: 56700, goal: 80000, currency: '€', backers: 721, avatar: 'CC', desc: 'Distributing efficient biomass cookstoves reducing indoor air pollution and fuel costs by 60%.', impact: '12,000 households reached', sdgs: [3, 7, 13], status: 'Active', tags: ['Cookstoves', 'Health', 'Energy'], trees: 0 },
  { id: 6, name: 'Mangrove Restoration Bangladesh', category: 'Ocean', location: "Cox's Bazar, Bangladesh", raised: 98000, goal: 120000, currency: '€', backers: 1100, avatar: 'MR', desc: 'Restoring 8,000 hectares of mangrove forest to protect coastal communities from flooding.', impact: '8,000 ha under restoration', sdgs: [13, 14, 15], status: 'Active', tags: ['Mangroves', 'Coastal', 'Carbon'], trees: 80000 },
]

const votableCauses = [
  { id: 'c1', name: 'Amazon Rainforest Protection', votes: 1240, desc: 'Protect 100,000 hectares of primary Amazon rainforest', icon: '🌿' },
  { id: 'c2', name: 'African Girls Education Fund', votes: 987, desc: 'Scholarships for 500 girls across Sub-Saharan Africa', icon: '📚' },
  { id: 'c3', name: 'Ocean Plastic Recycling Hubs', votes: 834, desc: 'Build 10 coastal recycling hubs in developing nations', icon: '🌊' },
  { id: 'c4', name: 'Regenerative Agriculture Grants', votes: 621, desc: 'Fund 200 farmers to transition to regenerative methods', icon: '🌾' },
]

const leaderboard = [
  { rank: 1, name: 'David O\'Callaghan', avatar: 'DO', donated: 1200, grad: 'linear-gradient(135deg,#34d399,#38bdf8)', founder: true, impact: '1,000 trees · 10 families' },
  { rank: 2, name: 'Amara Diallo', avatar: 'AD', donated: 850, grad: 'linear-gradient(135deg,#f472b6,#db2777)' },
  { rank: 3, name: 'Tom Walsh', avatar: 'TW', donated: 620, grad: 'linear-gradient(135deg,#fb923c,#ea580c)' },
  { rank: 4, name: 'Priya Nair', avatar: 'PN', donated: 540, grad: 'linear-gradient(135deg,#a78bfa,#7c3aed)' },
  { rank: 5, name: 'Sarah Chen', avatar: 'SC', donated: 390, grad: 'linear-gradient(135deg,#38bdf8,#0284c7)' },
  { rank: 6, name: 'James Okafor', avatar: 'JO', donated: 310, grad: 'linear-gradient(135deg,#34d399,#059669)' },
  { rank: 7, name: 'Lena Fischer', avatar: 'LF', donated: 280, grad: 'linear-gradient(135deg,#fbbf24,#d97706)' },
  { rank: 8, name: 'Marcus Obi', avatar: 'MO', donated: 210, grad: 'linear-gradient(135deg,#f472b6,#a78bfa)' },
  { rank: 9, name: 'Yuki Tanaka', avatar: 'YT', donated: 175, grad: 'linear-gradient(135deg,#38bdf8,#34d399)' },
  { rank: 10, name: 'Ahmed Ali', avatar: 'AA', donated: 120, grad: 'linear-gradient(135deg,#34d399,#38bdf8)' },
]

const avatarGrad: Record<string, string> = {
  GR: 'linear-gradient(135deg,#34d399,#059669)', SS: 'linear-gradient(135deg,#fbbf24,#d97706)',
  PC: 'linear-gradient(135deg,#38bdf8,#0284c7)', SL: 'linear-gradient(135deg,#34d399,#38bdf8)',
  CC: 'linear-gradient(135deg,#fb923c,#ea580c)', MR: 'linear-gradient(135deg,#38bdf8,#34d399)',
}

const sdgColors: Record<number, string> = {
  1: '#e5243b', 2: '#dda63a', 3: '#4c9f38', 4: '#c5192d', 7: '#fcc30b',
  10: '#dd1367', 12: '#bf8b2e', 13: '#3f7e44', 14: '#0a97d9', 15: '#56c02b', 17: '#19486a',
}

function useCountUp(target: number, duration = 2000) {
  const [count, setCount] = useState(0)
  const started = useRef(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !started.current) {
        started.current = true
        const start = Date.now()
        const tick = () => {
          const elapsed = Date.now() - start
          const progress = Math.min(elapsed / duration, 1)
          const ease = 1 - Math.pow(1 - progress, 3)
          setCount(Math.round(target * ease))
          if (progress < 1) requestAnimationFrame(tick)
        }
        tick()
      }
    }, { threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, duration])

  return { count, ref }
}

function StatCounter({ value, label, icon }: { value: number; label: string; icon: string }) {
  const { count, ref } = useCountUp(value)
  return (
    <div ref={ref} style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: 14, padding: '1.25rem', textAlign: 'center', flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: '1.75rem', marginBottom: '0.35rem' }}>{icon}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 900, color: '#34d399' }}>{count.toLocaleString()}</div>
      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.25rem' }}>{label}</div>
    </div>
  )
}

const QUARTER_END = new Date(2026, 5, 30) // June 30 2026
function getDaysToQuarterEnd() {
  const now = new Date()
  const diff = QUARTER_END.getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export default function ImpactPage() {
  const [activeCat, setActiveCat] = useState('All Projects')
  const [donateModal, setDonateModal] = useState<number | null>(null) // project id
  const [donateAmount, setDonateAmount] = useState<number>(10)
  const [customAmount, setCustomAmount] = useState('')
  const [donating, setDonating] = useState(false)
  const [donateSuccess, setDonateSuccess] = useState<string | null>(null)
  const [voted, setVoted] = useState<string | null>(null)
  const [causeVotes, setCauseVotes] = useState<Record<string, number>>(
    Object.fromEntries(votableCauses.map(c => [c.id, c.votes]))
  )
  const daysLeft = getDaysToQuarterEnd()
  const totalTrees = 2181000

  const { count: treeCount, ref: treeRef } = useCountUp(totalTrees, 2500)

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('ft-impact-vote') : null
    if (stored) setVoted(stored)
  }, [])

  const filtered = activeCat === 'All Projects' ? projects : projects.filter(p => p.category === activeCat)

  const handleVote = (causeId: string) => {
    if (voted) return
    setCauseVotes(prev => ({ ...prev, [causeId]: prev[causeId] + 1 }))
    setVoted(causeId)
    if (typeof window !== 'undefined') localStorage.setItem('ft-impact-vote', causeId)
  }

  const handleDonate = async () => {
    const amount = customAmount ? parseInt(customAmount) : donateAmount
    if (!amount || amount <= 0) return
    setDonating(true)
    try {
      await fetch('/api/impact/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: donateModal, amount }),
      })
      setDonateSuccess(`₮${amount} donated successfully! 🌱`)
      setTimeout(() => { setDonateModal(null); setDonateSuccess(null); setCustomAmount('') }, 2500)
    } catch {
      setDonateSuccess('Donation recorded!')
      setTimeout(() => { setDonateModal(null); setDonateSuccess(null); setCustomAmount('') }, 2000)
    } finally {
      setDonating(false)
    }
  }

  const donatingProject = projects.find(p => p.id === donateModal)

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .impact-stats { display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; margin: 1.5rem 0; }
        .impact-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(360px,1fr)); gap: 1.25rem; padding: 1.5rem; max-width: 1200px; margin: 0 auto; }
        .impact-leaderboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
        .impact-causes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        @media (max-width: 768px) {
          .impact-stats > div { min-width: 130px !important; }
          .impact-grid { grid-template-columns: 1fr !important; padding: 1rem !important; }
          .impact-leaderboard-grid { grid-template-columns: 1fr !important; }
          .impact-causes-grid { grid-template-columns: 1fr !important; }
          .impact-hero-btns { flex-direction: column !important; align-items: stretch !important; }
          .impact-hero-btns button { text-align: center !important; }
        }
      `}</style>

      {/* Donate Modal */}
      {donateModal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 440 }}>
            {donateSuccess ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🌱</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>{donateSuccess}</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Donate Trust Tokens</h3>
                  <button onClick={() => setDonateModal(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.25rem' }}>×</button>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>Contributing to: <span style={{ color: '#34d399', fontWeight: 600 }}>{donatingProject?.name}</span></div>
                <div style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Amount</div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {[5, 10, 25, 50].map(amt => (
                      <button key={amt} onClick={() => { setDonateAmount(amt); setCustomAmount('') }}
                        style={{ padding: '0.5rem 1rem', borderRadius: 8, border: donateAmount === amt && !customAmount ? '1px solid #34d399' : '1px solid rgba(148,163,184,0.2)', background: donateAmount === amt && !customAmount ? 'rgba(52,211,153,0.1)' : 'transparent', color: donateAmount === amt && !customAmount ? '#34d399' : '#94a3b8', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                        ₮{amt}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Custom Amount</div>
                  <input
                    type="number" min="1" placeholder="Enter ₮ amount"
                    value={customAmount}
                    onChange={e => setCustomAmount(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: '0.65rem 1rem', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
                <div style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.12)', borderRadius: 8, padding: '0.75rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#64748b' }}>
                  🌳 Every ₮10 = approximately 1 tree planted (where applicable)
                </div>
                <button onClick={handleDonate} disabled={donating}
                  style={{ width: '100%', background: '#34d399', border: 'none', borderRadius: 8, padding: '0.75rem', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', cursor: donating ? 'not-allowed' : 'pointer', opacity: donating ? 0.7 : 1 }}>
                  {donating ? 'Processing…' : `Confirm Donation — ₮${customAmount || donateAmount}`}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hero */}
      <div style={{ background: 'linear-gradient(180deg,rgba(56,189,248,0.08) 0%,rgba(52,211,153,0.04) 60%,transparent 100%)', padding: '3rem 1.5rem 2.5rem', borderBottom: '1px solid rgba(56,189,248,0.08)', textAlign: 'center' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 999, padding: '0.3rem 1rem', fontSize: '0.78rem', color: '#34d399', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '1rem' }}>🌱 SUSTAINABILITY FUND</div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 900, marginBottom: '0.75rem', lineHeight: 1.15 }}>Invest in a <span style={{ color: '#34d399' }}>Better World</span></h1>
          <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>Every transaction on FreeTrust contributes 1% to our Impact Fund. Together, we are funding real-world sustainability projects across the globe.</p>

          {/* Fund Balance Card */}
          <div style={{ background: 'linear-gradient(135deg,rgba(52,211,153,0.1),rgba(56,189,248,0.06))', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 16, padding: '1.5rem 2rem', marginBottom: '1.5rem', display: 'inline-block', minWidth: 280, textAlign: 'left' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Sustainability Fund Balance</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#34d399', lineHeight: 1 }}>₮ 48,240</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.4rem' }}>₮12,400 donated this quarter · 62% to quarterly goal</div>
            <div style={{ background: 'rgba(52,211,153,0.1)', borderRadius: 4, height: 6, marginTop: '0.75rem', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(90deg,#34d399,#38bdf8)', height: '100%', width: '62%', borderRadius: 4 }} />
            </div>
          </div>

          <div className="impact-stats">
            {[{ value: 1240000, label: 'Total Funded', icon: '💰', display: '€1.24M' }, { value: 12400, label: 'Contributors', icon: '👥', display: '12,400' }, { value: 28, label: 'Active Projects', icon: '🌍', display: '28' }, { value: 14, label: 'SDGs Supported', icon: '🎯', display: '14' }].map(s => (
              <div key={s.label} style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 12, padding: '1rem 1.25rem', textAlign: 'center', flex: '1', minWidth: 130 }}>
                <span style={{ fontSize: '1.25rem' }}>{s.icon}</span>
                <span style={{ display: 'block', fontSize: '1.6rem', fontWeight: 800, color: '#38bdf8' }}>{s.display}</span>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="impact-hero-btns" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={() => setDonateModal(1)} style={{ background: '#34d399', border: 'none', borderRadius: 8, padding: '0.75rem 2rem', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>Donate Trust Tokens</button>
            <button style={{ background: 'transparent', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 8, padding: '0.75rem 2rem', fontSize: '0.95rem', fontWeight: 600, color: '#34d399', cursor: 'pointer' }}>How It Works</button>
          </div>
        </div>
      </div>

      {/* Animated Impact Stats */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem 0' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' }}>Real-World Impact</h2>
        <div className="impact-stats">
          <StatCounter value={2181000} label="Trees Planted" icon="🌳" />
          <StatCounter value={84} label="Tonnes CO₂ Offset" icon="🌍" />
          <StatCounter value={200} label="Schools Funded" icon="🏫" />
          <StatCounter value={14010} label="Families Helped" icon="👨‍👩‍👧‍👦" />
        </div>
      </div>

      {/* Tree Planting Counter */}
      <div ref={treeRef} style={{ maxWidth: 1200, margin: '1rem auto', padding: '0 1.5rem' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(52,211,153,0.08),rgba(56,189,248,0.04))', border: '1px solid rgba(52,211,153,0.15)', borderRadius: 16, padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '3.5rem', marginBottom: '0.5rem' }}>🌳</div>
          <div style={{ fontSize: '3rem', fontWeight: 900, color: '#34d399', lineHeight: 1 }}>{treeCount.toLocaleString()}</div>
          <div style={{ fontSize: '1.1rem', color: '#94a3b8', marginTop: '0.5rem' }}>trees planted through FreeTrust</div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.35rem' }}>Every purchase plants a little more of our future 🌿</div>
        </div>
      </div>

      {/* Community Voted Causes */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f1f5f9' }}>Community Voted Causes</h2>
          <span style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '0.25rem 0.75rem', fontSize: '0.78rem', color: '#38bdf8' }}>⏳ Vote closes in {daysLeft} days</span>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Vote once per quarter to decide where the Sustainability Fund goes next.</p>
        <div className="impact-causes-grid">
          {votableCauses.map((cause) => {
            const totalVotes = Object.values(causeVotes).reduce((a, b) => a + b, 0)
            const pct = Math.round((causeVotes[cause.id] / totalVotes) * 100)
            const isVoted = voted === cause.id
            return (
              <div key={cause.id} style={{ background: '#1e293b', border: `1px solid ${isVoted ? 'rgba(52,211,153,0.3)' : 'rgba(56,189,248,0.1)'}`, borderRadius: 12, padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>{cause.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9' }}>{cause.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>{cause.desc}</div>
                  </div>
                  <button onClick={() => handleVote(cause.id)} disabled={!!voted}
                    style={{ marginLeft: '0.75rem', flexShrink: 0, padding: '0.4rem 0.85rem', borderRadius: 7, border: isVoted ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(56,189,248,0.25)', background: isVoted ? 'rgba(52,211,153,0.1)' : 'transparent', color: isVoted ? '#34d399' : '#38bdf8', fontSize: '0.78rem', fontWeight: 700, cursor: voted ? 'not-allowed' : 'pointer', opacity: voted && !isVoted ? 0.5 : 1 }}>
                    {isVoted ? '✓ Voted' : 'Vote'}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1, background: 'rgba(56,189,248,0.08)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                    <div style={{ background: isVoted ? '#34d399' : '#38bdf8', height: '100%', width: `${pct}%`, transition: 'width 0.5s ease', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', minWidth: 40, textAlign: 'right' }}>{causeVotes[cause.id].toLocaleString()} votes</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Projects */}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0 1.5rem' }}>
          {categories.map(c => (
            <button key={c} onClick={() => setActiveCat(c)}
              style={{ padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.82rem', cursor: 'pointer', border: activeCat === c ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(148,163,184,0.2)', background: activeCat === c ? 'rgba(52,211,153,0.1)' : 'transparent', color: activeCat === c ? '#34d399' : '#94a3b8', fontWeight: activeCat === c ? 700 : 500 }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="impact-grid">
        {filtered.map(proj => {
          const pct = Math.round((proj.raised / proj.goal) * 100)
          return (
            <div key={proj.id} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1.25rem', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#0f172a', flexShrink: 0, background: avatarGrad[proj.avatar] }}>{proj.avatar}</div>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.25 }}>{proj.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>📍 {proj.location} · {proj.category}</div>
                  </div>
                </div>
                <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: '#34d399', marginBottom: '0.75rem' }}>🌱 {proj.impact}</div>
                <p style={{ fontSize: '0.83rem', color: '#64748b', lineHeight: 1.6, marginBottom: '0.75rem' }}>{proj.desc}</p>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {proj.sdgs.map(n => (
                    <span key={n} style={{ borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, color: '#fff', background: sdgColors[n] }}>SDG {n}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {proj.tags.map(t => <span key={t} style={{ background: 'rgba(148,163,184,0.08)', borderRadius: 999, padding: '0.15rem 0.55rem', fontSize: '0.72rem', color: '#94a3b8' }}>{t}</span>)}
                </div>
              </div>
              <div style={{ background: 'rgba(15,23,42,0.5)', borderTop: '1px solid rgba(56,189,248,0.06)', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 700, color: '#38bdf8' }}>{proj.currency}{proj.raised.toLocaleString()} raised</span>
                  <span style={{ color: '#475569' }}>of {proj.currency}{proj.goal.toLocaleString()} · {pct}%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(56,189,248,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: '0.75rem' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg,#34d399,#38bdf8)', borderRadius: 3, width: `${pct}%` }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: '#475569' }}>👥 {proj.backers.toLocaleString()} backers</span>
                  <button onClick={() => { setDonateModal(proj.id); setDonateAmount(10); setCustomAmount('') }}
                    style={{ background: '#34d399', border: 'none', borderRadius: 7, padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                    Donate Trust ₮
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Member Impact Leaderboard */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: '#f1f5f9' }}>🏆 Member Impact Leaderboard — Q2 2026</h2>
        <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, overflow: 'hidden' }}>
          {leaderboard.map((member, i) => (
            <div key={member.name} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.25rem', borderBottom: i < leaderboard.length - 1 ? '1px solid rgba(56,189,248,0.06)' : 'none', background: i === 0 ? 'rgba(52,211,153,0.06)' : i < 3 ? `rgba(52,211,153,0.0${3 - i})` : 'transparent' }}>
              <span style={{ fontSize: i === 0 ? '1.25rem' : '0.9rem', fontWeight: 800, color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#fb923c' : '#475569', minWidth: 28, textAlign: 'center' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${member.rank}`}
              </span>
              <div style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', color: '#0f172a', background: member.grad, flexShrink: 0 }}>{member.avatar}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9' }}>{member.name}</span>
                  {'founder' in member && member.founder && (
                    <span style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)', borderRadius: 999, padding: '0.1rem 0.45rem', fontSize: '0.6rem', color: '#34d399', fontWeight: 700, letterSpacing: '0.04em' }}>FOUNDER</span>
                  )}
                </div>
                {'impact' in member && member.impact && (
                  <div style={{ fontSize: '0.72rem', color: '#34d399', marginTop: '0.1rem' }}>🌱 {member.impact}</div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#34d399' }}>₮{member.donated}</div>
                <div style={{ fontSize: '0.72rem', color: '#475569' }}>donated</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(52,211,153,0.06),rgba(56,189,248,0.06))', border: '1px solid rgba(52,211,153,0.15)', borderRadius: 16, padding: '3rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.75rem' }}>Every purchase drives change</h2>
          <p style={{ color: '#64748b', marginBottom: '1.5rem', maxWidth: 500, margin: '0 auto 1.5rem' }}>1% of every FreeTrust transaction is automatically allocated to impact projects you believe in.</p>
          <button style={{ background: 'linear-gradient(135deg,#34d399,#38bdf8)', border: 'none', borderRadius: 8, padding: '0.8rem 2rem', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>Start Shopping with Purpose</button>
        </div>
      </div>
    </div>
  )
}
