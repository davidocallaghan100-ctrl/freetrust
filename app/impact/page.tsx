'use client'
import React, { useState, useEffect, useRef, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface ImpactProject {
  id: string
  name: string
  category: string
  location: string
  description: string
  impact_headline: string
  source?: string | null
  sdgs: number[]
  tags: string[]
  avatar_initials: string
  avatar_gradient: string
  raised: number
  goal: number
  currency: string
  backers: number
  status: string
}

interface ImpactStats {
  totalRaised: number
  totalBackers: number
  activeProjects: number
  memberCount: number
  fundBalance: number
  fundLifetime: number
  quarterlyTotal: number
  quarterlyGoal: number
  quarterlyPct: number
}

// Discriminated donation target — either the general Sustainability
// Fund or a specific impact project. Using a tagged union (instead of
// `ImpactProject | null` plus a separate "fund mode" boolean) keeps
// the rendering / API code from having to special-case fund donations
// at every callsite.
type DonateTarget =
  | { kind: 'fund' }
  | { kind: 'project'; project: ImpactProject }

interface LeaderboardEntry {
  rank: number
  user_id: string
  full_name: string
  avatar_url: string | null
  donated: number
  is_founder: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['All Projects', 'Reforestation', 'Clean Energy', 'Ocean', 'Education', 'Food Security', 'Biodiversity']

const VOTABLE_CAUSES = [
  { id: 'c1', name: 'Amazon Rainforest Protection', desc: 'Protect 100,000 hectares of primary Amazon rainforest', icon: '🌿' },
  { id: 'c2', name: 'African Girls Education Fund', desc: 'Scholarships for 500 girls across Sub-Saharan Africa', icon: '📚' },
  { id: 'c3', name: 'Ocean Plastic Recycling Hubs', desc: 'Build 10 coastal recycling hubs in developing nations', icon: '🌊' },
  { id: 'c4', name: 'Regenerative Agriculture Grants', desc: 'Fund 200 farmers to transition to regenerative methods', icon: '🌾' },
]

const SDG_COLORS: Record<number, string> = {
  1: '#e5243b', 2: '#dda63a', 3: '#4c9f38', 4: '#c5192d', 7: '#fcc30b',
  10: '#dd1367', 12: '#bf8b2e', 13: '#3f7e44', 14: '#0a97d9', 15: '#56c02b', 17: '#19486a',
}

const QUARTER_END = new Date(2026, 5, 30)
function getDaysToQuarterEnd() {
  return Math.max(0, Math.ceil((QUARTER_END.getTime() - Date.now()) / 86400000))
}

// ── Animated Counter ──────────────────────────────────────────────────────────

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
          setCount(Math.round(target * (1 - Math.pow(1 - progress, 3))))
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

// ── User Avatar ───────────────────────────────────────────────────────────────

function UserAvatar({ url, name, size = 36 }: { url: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
  const colors = ['#34d399', '#38bdf8', '#a78bfa', '#f472b6', '#fb923c', '#fbbf24']
  const bg = colors[(name.charCodeAt(0) ?? 0) % colors.length]
  if (url) return <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: `linear-gradient(135deg,${bg},${bg}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.32, fontWeight: 800, color: '#0f172a', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ImpactPage() {
  const [projects, setProjects] = useState<ImpactProject[]>([])
  const [stats, setStats] = useState<ImpactStats | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [voteTallies, setVoteTallies] = useState<Record<string, number>>({})
  const [myVote, setMyVote] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeCat, setActiveCat] = useState('All Projects')
  const [donateTarget, setDonateTarget] = useState<DonateTarget | null>(null)
  const [donateAmount, setDonateAmount] = useState(10)
  const [customAmount, setCustomAmount] = useState('')
  const [donating, setDonating] = useState(false)
  const [donateSuccess, setDonateSuccess] = useState<string | null>(null)
  const [donateError, setDonateError] = useState<string | null>(null)
  const [voting, setVoting] = useState(false)
  const [trustBalance, setTrustBalance] = useState(0)
  const [platformStats, setPlatformStats] = useState<{ members?: { total: number }; listings?: { services: number; products: number }; trust?: { total: number; inCirculation: number; membersHolding: number } } | null>(null)

  const daysLeft = getDaysToQuarterEnd()

  const loadAll = useCallback(async () => {
    try {
      const [projRes, statsRes, lbRes, voteRes, trustRes, platformStatsRes] = await Promise.all([
        fetch('/api/impact/projects'),
        fetch('/api/impact/stats'),
        fetch('/api/impact/leaderboard'),
        fetch('/api/impact/vote'),
        fetch('/api/trust'),
        fetch('/api/stats'),
      ])
      if (projRes.ok) { const d = await projRes.json() as { projects: ImpactProject[] }; setProjects(d.projects ?? []) }
      if (statsRes.ok) { const d = await statsRes.json() as ImpactStats; setStats(d) }
      if (lbRes.ok) { const d = await lbRes.json() as { leaderboard: LeaderboardEntry[] }; setLeaderboard(d.leaderboard ?? []) }
      if (voteRes.ok) { const d = await voteRes.json() as { tallies: Record<string, number>; myVote: string | null }; setVoteTallies(d.tallies ?? {}); setMyVote(d.myVote ?? null) }
      if (trustRes.ok) { const d = await trustRes.json() as { balance?: number }; setTrustBalance(d.balance ?? 0) }
      if (platformStatsRes.ok) {
        const d = await platformStatsRes.json() as { members?: { total: number }; listings?: { services: number; products: number }; trust?: { total: number; inCirculation: number; membersHolding: number } }
        setPlatformStats(d)
      }
    } catch (err) {
      console.error('Impact loadAll error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const filtered = activeCat === 'All Projects' ? projects : projects.filter(p => p.category === activeCat)
  const totalVotes = Math.max(Object.values(voteTallies).reduce((a, b) => a + b, 0), 1)

  const handleVote = async (causeId: string) => {
    if (myVote || voting) return
    setVoting(true)
    try {
      const res = await fetch('/api/impact/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cause_id: causeId }) })
      if (res.ok) { setMyVote(causeId); setVoteTallies(prev => ({ ...prev, [causeId]: (prev[causeId] ?? 0) + 1 })) }
    } catch { /* silent */ } finally { setVoting(false) }
  }

  const handleDonate = async () => {
    if (!donateTarget) return
    const parsedCustom = customAmount ? parseInt(customAmount, 10) : NaN
    const amount = Number.isFinite(parsedCustom) && parsedCustom > 0 ? parsedCustom : donateAmount
    if (!amount || amount <= 0) {
      setDonateError('Enter a positive amount')
      return
    }
    if (amount > trustBalance) {
      setDonateError(`Insufficient ₮ balance. You have ₮${trustBalance.toLocaleString()}.`)
      return
    }
    setDonating(true)
    setDonateError(null)
    try {
      const projectId = donateTarget.kind === 'project' ? donateTarget.project.id : null
      const res = await fetch('/api/impact/donate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ amount, projectId }),
      })
      const data = await res.json() as {
        ok?:               boolean
        error?:            string
        code?:             string
        trees_equivalent?: number
        new_fund_balance?: number
        fund_lifetime?:    number
        new_user_balance?: number
      }
      if (!res.ok || !data.ok) {
        // Surface the real server error instead of swallowing it.
        setDonateError(data.error ?? 'Donation failed. Please try again.')
        return
      }

      // Apply the authoritative new balances returned by the server
      // immediately, so the UI shows fresh numbers without waiting on
      // the loadAll re-fetch below.
      if (typeof data.new_user_balance === 'number') {
        setTrustBalance(data.new_user_balance)
      }
      if (typeof data.new_fund_balance === 'number') {
        setStats(prev =>
          prev
            ? { ...prev, fundBalance: data.new_fund_balance!, fundLifetime: data.fund_lifetime ?? prev.fundLifetime }
            : prev,
        )
      }

      setDonateSuccess(
        `₮${amount} donated! 🌱${data.trees_equivalent ? ` ~${data.trees_equivalent} trees` : ''}`,
      )

      // Re-fetch every data source so projects.raised / backers /
      // leaderboard / stats all reflect the new state. This is the
      // belt-and-braces guarantee that the UI never shows stale
      // numbers after a successful donation.
      void loadAll()

      setTimeout(() => {
        setDonateTarget(null)
        setDonateSuccess(null)
        setCustomAmount('')
      }, 2500)
    } catch (err) {
      console.error('Impact donate error:', err)
      setDonateError('Network error. Please try again.')
    } finally {
      setDonating(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', background: '#0f172a' }}>
        <div style={{ width: 32, height: 32, border: '3px solid rgba(52,211,153,0.2)', borderTopColor: '#34d399', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .impact-stats{display:flex;gap:1rem;flex-wrap:wrap;justify-content:center;margin:1.5rem 0}
        .impact-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1.25rem;padding:1.5rem;max-width:1200px;margin:0 auto}
        .impact-causes-grid{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
        .trust-econ-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}
        @media(max-width:768px){
          .impact-grid{grid-template-columns:1fr!important;padding:1rem!important}
          .impact-causes-grid{grid-template-columns:1fr!important}
          .impact-hero-btns{flex-direction:column!important;align-items:stretch!important}
          .trust-econ-grid{grid-template-columns:1fr!important}
        }
      `}</style>

      {/* Donate Modal */}
      {donateTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#1e293b', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 16, padding: '1.75rem', width: '100%', maxWidth: 440 }}>
            {donateSuccess ? (
              <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🌱</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>{donateSuccess}</div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Donate Trust Tokens</h3>
                  <button onClick={() => { setDonateTarget(null); setDonateError(null) }} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.4rem', lineHeight: 1, padding: 0 }}>×</button>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '0.35rem' }}>Contributing to:</div>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#34d399', marginBottom: '0.75rem' }}>
                  {donateTarget.kind === 'project' ? donateTarget.project.name : 'Sustainability Fund (general)'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.75rem' }}>Your Trust Balance: <strong style={{ color: '#38bdf8' }}>₮{trustBalance.toLocaleString()}</strong></div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                  {[5, 10, 25, 50].map(amt => (
                    <button key={amt} onClick={() => { setDonateAmount(amt); setCustomAmount(''); setDonateError(null) }}
                      style={{ padding: '0.5rem 1rem', borderRadius: 8, border: donateAmount === amt && !customAmount ? '1px solid #34d399' : '1px solid rgba(148,163,184,0.2)', background: donateAmount === amt && !customAmount ? 'rgba(52,211,153,0.1)' : 'transparent', color: donateAmount === amt && !customAmount ? '#34d399' : '#94a3b8', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem' }}>
                      ₮{amt}
                    </button>
                  ))}
                </div>
                <input type="number" min="1" max={trustBalance} placeholder="Custom ₮ amount" value={customAmount} onChange={e => { setCustomAmount(e.target.value); setDonateError(null) }}
                  style={{ width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: '0.65rem 1rem', color: '#f1f5f9', fontSize: '0.9rem', outline: 'none', marginBottom: '1rem' }} />
                <div style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.12)', borderRadius: 8, padding: '0.65rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
                  🌳 Every ₮10 ≈ 1 tree planted (where applicable)
                </div>
                {donateError && (
                  <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, padding: '0.65rem 0.85rem', marginBottom: '0.85rem', fontSize: '0.8rem', color: '#f87171' }}>
                    {donateError}
                  </div>
                )}
                <button onClick={handleDonate} disabled={donating || (customAmount ? parseInt(customAmount) > trustBalance : donateAmount > trustBalance)}
                  style={{ width: '100%', background: '#34d399', border: 'none', borderRadius: 8, padding: '0.75rem', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', cursor: donating ? 'not-allowed' : 'pointer', opacity: donating ? 0.7 : 1 }}>
                  {donating ? 'Processing…' : `Donate ₮${customAmount || donateAmount}`}
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
          <div style={{ background: 'linear-gradient(135deg,rgba(52,211,153,0.1),rgba(56,189,248,0.06))', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 16, padding: '1.5rem 2rem', marginBottom: '1.5rem', display: 'inline-block', minWidth: 280, textAlign: 'left' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Sustainability Fund Balance</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#34d399', lineHeight: 1 }}>₮{(stats?.fundBalance ?? 0).toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Lifetime donated: <strong style={{ color: '#94a3b8' }}>₮{(stats?.fundLifetime ?? 0).toLocaleString()}</strong>
            </div>
            {(stats?.fundBalance ?? 0) === 0
              ? <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.4rem' }}>Grows with every transaction — be the first to contribute 🌱</div>
              : <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.4rem' }}>₮{(stats?.quarterlyTotal ?? 0).toLocaleString()} donated this quarter · {stats?.quarterlyPct ?? 0}% to goal</div>
            }
            <div style={{ background: 'rgba(52,211,153,0.1)', borderRadius: 4, height: 6, marginTop: '0.75rem', overflow: 'hidden' }}>
              <div style={{ background: 'linear-gradient(90deg,#34d399,#38bdf8)', height: '100%', width: `${Math.max(stats?.quarterlyPct ?? 0, (stats?.fundBalance ?? 0) > 0 ? 2 : 0)}%`, borderRadius: 4 }} />
            </div>
          </div>
          <div className="impact-stats">
            {[
              { label: 'Members', icon: '🎯', val: (platformStats?.members?.total ?? stats?.memberCount ?? 0).toLocaleString(), color: '#38bdf8' },
              { label: 'Active Projects', icon: '🌱', val: (stats?.activeProjects ?? 0).toLocaleString(), color: '#34d399' },
              { label: 'Impact Fund', icon: '💚', val: `₮${(stats?.fundBalance ?? 0).toLocaleString()}`, color: '#34d399' },
              { label: '₮ in Circulation', icon: '₮', val: `₮${(platformStats?.trust?.inCirculation ?? 0).toLocaleString()}`, color: '#2dd4bf' },
              { label: '₮ Issued (Total)', icon: '📈', val: `₮${(platformStats?.trust?.total ?? 0).toLocaleString()}`, color: '#38bdf8' },
              { label: 'Members Holding ₮', icon: '🤝', val: (platformStats?.trust?.membersHolding ?? 0).toLocaleString(), color: '#a78bfa' },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 12, padding: '1rem 1.25rem', textAlign: 'center', flex: 1, minWidth: 130 }}>
                <span style={{ fontSize: '1.25rem' }}>{s.icon}</span>
                <span style={{ display: 'block', fontSize: '1.6rem', fontWeight: 800, color: s.color }}>{s.val}</span>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div className="impact-hero-btns" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={() => { setDonateTarget({ kind: 'fund' }); setDonateAmount(10); setCustomAmount(''); setDonateError(null) }}
              style={{ background: '#34d399', border: 'none', borderRadius: 8, padding: '0.75rem 2rem', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
              Donate Trust Tokens
            </button>
          </div>
        </div>
      </div>

      {/* Trust Economy — live figures */}
      <div style={{ maxWidth: 1200, margin: '2rem auto 0', padding: '0 1.5rem' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(45,212,191,0.07),rgba(56,189,248,0.04))', border: '1px solid rgba(45,212,191,0.2)', borderRadius: 16, padding: '1.5rem 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f1f5f9' }}>₮ Trust Economy</span>
            <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#2dd4bf', background: 'rgba(45,212,191,0.1)', border: '1px solid rgba(45,212,191,0.25)', borderRadius: 999, padding: '2px 8px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Live</span>
            <span style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: 'auto' }}>All figures pulled live from Supabase</span>
          </div>
          <div className="trust-econ-grid">
            {[
              {
                icon: '₮',
                val: `₮${(platformStats?.trust?.inCirculation ?? 0).toLocaleString()}`,
                label: 'Total ₮ in Circulation',
                sub: 'Sum of all current member balances',
                color: '#2dd4bf',
              },
              {
                icon: '📈',
                val: `₮${(platformStats?.trust?.total ?? 0).toLocaleString()}`,
                label: 'Total ₮ Issued Since Launch',
                sub: 'Lifetime earnings across all members',
                color: '#34d399',
              },
              {
                icon: '🤝',
                val: (platformStats?.trust?.membersHolding ?? 0).toLocaleString(),
                label: 'Members Holding ₮',
                sub: 'Members who have earned trust through activity',
                color: '#38bdf8',
              },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(15,23,42,0.5)', border: `1px solid ${s.color}25`, borderRadius: 12, padding: '1.25rem 1rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>{s.icon}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 900, color: s.color, letterSpacing: '-0.5px', lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#f1f5f9', marginTop: '0.4rem' }}>{s.label}</div>
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '0.2rem', lineHeight: 1.4 }}>{s.sub}</div>
              </div>
            ))}
          </div>
          {(platformStats?.trust?.total ?? 0) > 0 && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                ₮{(platformStats?.trust?.inCirculation ?? 0).toLocaleString()} in active circulation
                out of ₮{(platformStats?.trust?.total ?? 0).toLocaleString()} ever issued
              </span>
              <div style={{ flex: 1, background: 'rgba(45,212,191,0.1)', borderRadius: 4, height: 6, minWidth: 100, overflow: 'hidden' }}>
                <div style={{
                  background: 'linear-gradient(90deg,#2dd4bf,#38bdf8)',
                  height: '100%',
                  borderRadius: 4,
                  width: `${(platformStats?.trust?.total ?? 0) > 0 ? Math.round(((platformStats?.trust?.inCirculation ?? 0) / (platformStats?.trust?.total ?? 1)) * 100) : 0}%`,
                }} />
              </div>
              <span style={{ fontSize: '0.72rem', color: '#2dd4bf', fontWeight: 700 }}>
                {(platformStats?.trust?.total ?? 0) > 0
                  ? `${Math.round(((platformStats?.trust?.inCirculation ?? 0) / (platformStats?.trust?.total ?? 1)) * 100)}% retention`
                  : '—'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* How the fund works */}
      <div style={{ maxWidth: 1200, margin: '2rem auto 0', padding: '0 1.5rem' }}>
        <div style={{ background: 'rgba(52,211,153,0.05)', border: '1px solid rgba(52,211,153,0.15)', borderRadius: 16, padding: '1.75rem 2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.75rem', color: '#f1f5f9' }}>How the Sustainability Fund works</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {[
              { icon: '🛒', title: '1% per transaction', desc: 'Every sale on FreeTrust automatically contributes 1% of the transaction value to this fund.' },
              { icon: '🗳️', title: 'Community votes', desc: 'Members vote on which causes to fund each quarter. The highest-voted project receives the allocation.' },
              { icon: '✅', title: 'Verified disbursement', desc: 'Funds are sent directly to verified non-profit partners. All transactions will be published publicly.' },
            ].map(item => (
              <div key={item.title} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.2rem' }}>{item.title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trust Sustainability Reserve */}
      <div style={{ maxWidth: 1200, margin: '1.5rem auto', padding: '0 1.5rem' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(129,140,248,0.08),rgba(52,211,153,0.05))', border: '1px solid rgba(129,140,248,0.2)', borderRadius: 16, padding: '1.75rem 2rem' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(129,140,248,0.12)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 999, padding: '0.25rem 0.75rem', fontSize: '0.72rem', color: '#818cf8', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                🏛️ SPECULATIVE RESERVE FUND
              </div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.4rem' }}>Trust Sustainability Reserve</h3>
              <p style={{ fontSize: '0.83rem', color: '#64748b', lineHeight: 1.65, margin: '0 0 1rem', maxWidth: 480 }}>
                FreeTrust reserves <strong style={{ color: '#a5b4fc' }}>5% of all Trust ever issued</strong> as a Sustainability Reserve — a speculative fund held on behalf of the community for future high-impact projects that are not yet live. This reserve grows every time a member earns Trust, ensuring the platform always has capital ready to back transformational ideas.
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.78rem', color: '#64748b' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#34d399' }}>✓</span> Grows with the Trust economy</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#34d399' }}>✓</span> Community-governed deployment</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ color: '#34d399' }}>✓</span> Never spent without a vote</span>
              </div>
            </div>
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(129,140,248,0.25)', borderRadius: 14, padding: '1.25rem 1.75rem' }}>
                <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.4rem' }}>Reserve Balance</div>
                <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#818cf8', lineHeight: 1 }}>
                  ₮{Math.round((platformStats?.trust?.total ?? stats?.totalRaised ?? 0) * 0.05).toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.35rem' }}>5% of ₮{(platformStats?.trust?.total ?? stats?.totalRaised ?? 0).toLocaleString()} lifetime issued</div>
                <div style={{ background: 'rgba(129,140,248,0.08)', borderRadius: 4, height: 5, marginTop: '0.75rem', overflow: 'hidden' }}>
                  <div style={{ background: 'linear-gradient(90deg,#818cf8,#a78bfa)', height: '100%', width: '5%', borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: '0.68rem', color: '#475569', marginTop: '0.4rem' }}>grows automatically as Trust is earned</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* FreeTrust Vision */}
      <div style={{ maxWidth: 1200, margin: '1.5rem auto', padding: '0 1.5rem' }}>
        <div style={{ background: 'linear-gradient(135deg,rgba(56,189,248,0.06),rgba(52,211,153,0.04))', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 16, padding: '2rem' }}>
          <div style={{ display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 999, padding: '0.25rem 0.75rem', fontSize: '0.72rem', color: '#38bdf8', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.75rem' }}>🔭 THE FREETRUST VISION</div>
          <h2 style={{ fontSize: '1.7rem', fontWeight: 900, color: '#f1f5f9', margin: '0 0 1.25rem', lineHeight: 1.2 }}>Our <span style={{ color: '#38bdf8' }}>Vision</span></h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1.25rem' }}>
            {[
              { icon: '🌐', title: 'A Commerce System That Cares', desc: 'We are building a world where every transaction has a second purpose — funding the reforestation projects, ocean clean-ups, and communities that need it most.' },
              { icon: '⚖️', title: 'Trust as a Force for Good', desc: 'Trust is not just currency — it is accountability. When commerce is built on reputation, the incentives align: do good business, get rewarded, fund good in the world.' },
              { icon: '🌱', title: 'Growing the Reserve Until It Matters', desc: 'The Sustainability Reserve starts small and grows every day. Our goal: ₮1,000,000 in reserve — enough to fund landmark projects voted on by the entire community.' },
              { icon: '🔗', title: 'Transparent by Design', desc: 'Every Trust token issued, every donation made, every reserve movement is visible on-chain or on-ledger. No hidden allocations. No opaque funds. Just radical transparency.' },
            ].map(v => (
              <div key={v.title} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '1.5rem', flexShrink: 0, marginTop: '0.1rem' }}>{v.icon}</div>
                <div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.35rem' }}>{v.title}</div>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.65, margin: 0 }}>{v.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '1.5rem', padding: '1rem 1.25rem', background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.12)', borderRadius: 10, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6, fontStyle: 'italic', textAlign: 'center' }}>
            &ldquo;We are not just building a marketplace. We are proving that trust-based commerce and planetary responsibility can coexist — and that together, they are more powerful than either alone.&rdquo;
            <div style={{ marginTop: '0.5rem', fontSize: '0.78rem', color: '#475569', fontStyle: 'normal' }}>— FreeTrust Founding Principle</div>
          </div>
        </div>
      </div>

      {/* Community Voted Causes */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Community Voted Causes</h2>
          <span style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '0.25rem 0.75rem', fontSize: '0.78rem', color: '#38bdf8' }}>⏳ Vote closes in {daysLeft} days</span>
        </div>
        <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Vote once per quarter to decide where the Sustainability Fund goes next.</p>
        <div className="impact-causes-grid">
          {VOTABLE_CAUSES.map(cause => {
            const votes = voteTallies[cause.id] ?? 0
            const pct = Math.round((votes / totalVotes) * 100)
            const isVoted = myVote === cause.id
            return (
              <div key={cause.id} style={{ background: '#1e293b', border: `1px solid ${isVoted ? 'rgba(52,211,153,0.3)' : 'rgba(56,189,248,0.1)'}`, borderRadius: 12, padding: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '1.25rem', marginBottom: '0.35rem' }}>{cause.icon}</div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#f1f5f9' }}>{cause.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.2rem' }}>{cause.desc}</div>
                  </div>
                  <button onClick={() => handleVote(cause.id)} disabled={!!myVote || voting}
                    style={{ marginLeft: '0.75rem', flexShrink: 0, padding: '0.4rem 0.85rem', borderRadius: 7, border: isVoted ? '1px solid rgba(52,211,153,0.4)' : '1px solid rgba(56,189,248,0.25)', background: isVoted ? 'rgba(52,211,153,0.1)' : 'transparent', color: isVoted ? '#34d399' : '#38bdf8', fontSize: '0.78rem', fontWeight: 700, cursor: myVote ? 'not-allowed' : 'pointer', opacity: myVote && !isVoted ? 0.5 : 1 }}>
                    {isVoted ? '✓ Voted' : 'Vote'}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ flex: 1, background: 'rgba(56,189,248,0.08)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
                    <div style={{ background: isVoted ? '#34d399' : '#38bdf8', height: '100%', width: `${pct}%`, transition: 'width 0.5s ease', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#64748b', minWidth: 40, textAlign: 'right' }}>{votes.toLocaleString()} votes</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Category Filter + Projects */}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', padding: '0 1.5rem', marginBottom: '0.5rem' }}>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setActiveCat(c)}
              style={{ padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.82rem', cursor: 'pointer', border: activeCat === c ? '1px solid rgba(52,211,153,0.3)' : '1px solid rgba(148,163,184,0.2)', background: activeCat === c ? 'rgba(52,211,153,0.1)' : 'transparent', color: activeCat === c ? '#34d399' : '#94a3b8', fontWeight: activeCat === c ? 700 : 500 }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="impact-grid">
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', color: '#64748b', padding: '3rem' }}>No projects in this category yet.</div>
        )}
        {filtered.map(proj => {
          const pct = Math.min(Math.round((proj.raised / proj.goal) * 100), 100)
          return (
            <div key={proj.id} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '1.25rem', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: 48, height: 48, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', color: '#0f172a', flexShrink: 0, background: proj.avatar_gradient }}>{proj.avatar_initials}</div>
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.25 }}>{proj.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>📍 {proj.location} · {proj.category}</div>
                  </div>
                </div>
                <div style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 8, padding: '0.4rem 0.75rem', fontSize: '0.8rem', color: '#34d399', marginBottom: '0.5rem' }}>🌱 {proj.impact_headline}</div>
                {proj.source && <div style={{ fontSize: '0.68rem', color: '#475569', marginBottom: '0.75rem' }}>📊 Source: {proj.source}</div>}
                <p style={{ fontSize: '0.83rem', color: '#64748b', lineHeight: 1.6, marginBottom: '0.75rem' }}>{proj.description}</p>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  {(proj.sdgs ?? []).map(n => <span key={n} style={{ borderRadius: 4, padding: '0.15rem 0.5rem', fontSize: '0.68rem', fontWeight: 700, color: '#fff', background: SDG_COLORS[n] ?? '#475569' }}>SDG {n}</span>)}
                </div>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {(proj.tags ?? []).map(t => <span key={t} style={{ background: 'rgba(148,163,184,0.08)', borderRadius: 999, padding: '0.15rem 0.55rem', fontSize: '0.72rem', color: '#94a3b8' }}>{t}</span>)}
                </div>
              </div>
              <div style={{ background: 'rgba(15,23,42,0.5)', borderTop: '1px solid rgba(56,189,248,0.06)', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: 700, color: '#38bdf8' }}>{proj.currency}{Number(proj.raised).toLocaleString()} raised</span>
                  <span style={{ color: '#475569' }}>of {proj.currency}{Number(proj.goal).toLocaleString()} · {pct}%</span>
                </div>
                <div style={{ height: 6, background: 'rgba(56,189,248,0.1)', borderRadius: 3, overflow: 'hidden', marginBottom: '0.75rem' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg,#34d399,#38bdf8)', borderRadius: 3, width: `${pct}%` }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.78rem', color: '#475569' }}>👥 {Number(proj.backers).toLocaleString()} backers</span>
                  <button onClick={() => { setDonateTarget({ kind: 'project', project: proj }); setDonateAmount(10); setCustomAmount(''); setDonateError(null) }}
                    style={{ background: '#34d399', border: 'none', borderRadius: 7, padding: '0.45rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                    Donate ₮
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Leaderboard */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>🏆 Member Impact Leaderboard — Q2 2026</h2>
        {leaderboard.length === 0 ? (
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '2rem', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
            No donations yet — be the first to donate to an impact project! 🌱
          </div>
        ) : (
          <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, overflow: 'hidden' }}>
            {leaderboard.map((member, i) => (
              <div key={member.user_id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.25rem', borderBottom: i < leaderboard.length - 1 ? '1px solid rgba(56,189,248,0.06)' : 'none', background: i === 0 ? 'rgba(52,211,153,0.06)' : 'transparent' }}>
                <span style={{ fontSize: i < 3 ? '1.25rem' : '0.9rem', fontWeight: 800, color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#fb923c' : '#475569', minWidth: 28, textAlign: 'center' }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${member.rank}`}
                </span>
                <UserAvatar url={member.avatar_url} name={member.full_name} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9' }}>{member.full_name}</span>
                    {member.is_founder && (
                      <span style={{ background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.35)', borderRadius: 999, padding: '0.1rem 0.45rem', fontSize: '0.6rem', color: '#34d399', fontWeight: 700, letterSpacing: '0.04em' }}>FOUNDER</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#34d399' }}>₮{member.donated.toLocaleString()}</div>
                  <div style={{ fontSize: '0.72rem', color: '#475569' }}>donated</div>
                </div>
              </div>
            ))}
          </div>
        )}
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
