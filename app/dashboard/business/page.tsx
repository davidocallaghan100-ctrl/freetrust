'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Business {
  id: string
  name: string
  business_type: string
  industry: string
  trust_score: number
  follower_count: number
  verified: boolean
  verification_status: string
}

interface Stats {
  totalListings: number
  activeOrders: number
  totalRevenue: number
  teamCount: number
  reviewCount: number
  avgRating: number
}

export default function BusinessDashboardPage() {
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats>({ totalListings: 0, activeOrders: 0, totalRevenue: 0, teamCount: 0, reviewCount: 0, avgRating: 0 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return setLoading(false)

      // Load owned businesses
      const { data } = await supabase
        .from('businesses')
        .select('id, name, business_type, industry, trust_score, follower_count, verified, verification_status')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
      if (data) {
        setBusinesses(data)
        if (data.length > 0) setSelected(data[0].id)
      }
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (!selected) return
    const loadStats = async () => {
      const supabase = createClient()
      const [listingsRes, membersRes, reviewsRes] = await Promise.all([
        supabase.from('listings').select('id', { count: 'exact' }).eq('business_id', selected).eq('status', 'active'),
        supabase.from('business_members').select('id', { count: 'exact' }).eq('business_id', selected),
        supabase.from('business_reviews').select('rating').eq('business_id', selected),
      ])
      const reviews = reviewsRes.data ?? []
      const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0
      setStats({
        totalListings: listingsRes.count ?? 0,
        activeOrders: 0,
        totalRevenue: 0,
        teamCount: membersRes.count ?? 0,
        reviewCount: reviews.length,
        avgRating: Math.round(avgRating * 10) / 10,
      })
    }
    loadStats()
  }, [selected])

  const selectedBiz = businesses.find(b => b.id === selected)
  const TABS = ['overview', 'listings', 'team', 'analytics', 'verification']

  if (loading) return (
    <div style={{ minHeight: 'calc(100vh - 104px)', paddingTop: 104, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
      Loading…
    </div>
  )

  if (businesses.length === 0) return (
    <div style={{ minHeight: 'calc(100vh - 104px)', paddingTop: 104, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏢</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f1f5f9', marginBottom: '0.5rem' }}>No Business Profiles</h2>
        <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Create your first business profile to access the business dashboard</p>
        <Link href="/create-business" style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#0f172a', fontWeight: 700, padding: '0.75rem 1.75rem', borderRadius: 10, textDecoration: 'none', fontSize: '0.92rem' }}>
          + Create Business Profile
        </Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: 'calc(100vh - 104px)', paddingTop: 104, background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .bd-tab { padding: 0.55rem 1rem; border-radius: 8px; background: transparent; border: none; cursor: pointer; font-size: 0.83rem; color: #64748b; transition: all 0.12s; }
        .bd-tab.active { background: rgba(56,189,248,0.1); color: #38bdf8; font-weight: 600; }
        .bd-tab:hover { color: #f1f5f9; }
        .bd-stat { background: #1e293b; border: 1px solid rgba(56,189,248,0.08); border-radius: 12px; padding: 1rem 1.25rem; }
        .bd-stat-val { font-size: 1.6rem; font-weight: 800; color: #f1f5f9; }
        .bd-stat-lbl { font-size: 0.75rem; color: #64748b; margin-top: 2px; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.25rem' }}>Business Dashboard</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.82rem', color: '#64748b' }}>Viewing:</span>
              <select value={selected ?? ''} onChange={e => setSelected(e.target.value)} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 7, padding: '0.3rem 0.65rem', fontSize: '0.82rem', color: '#f1f5f9', outline: 'none' }}>
                {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {selectedBiz && (
              <Link href={`/business/${selectedBiz.id}`} style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.55rem 1rem', fontSize: '0.82rem', color: '#38bdf8', textDecoration: 'none' }}>
                View Profile →
              </Link>
            )}
            <Link href="/create-business" style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 8, padding: '0.55rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}>
              + New Business
            </Link>
          </div>
        </div>

        {/* Switch between personal / business */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <Link href="/dashboard" style={{ padding: '0.45rem 1rem', borderRadius: 8, background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', fontSize: '0.82rem', color: '#64748b', textDecoration: 'none' }}>
            👤 Personal
          </Link>
          <div style={{ padding: '0.45rem 1rem', borderRadius: 8, background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', fontSize: '0.82rem', color: '#38bdf8', fontWeight: 600 }}>
            🏢 Business
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(56,189,248,0.07)', paddingBottom: '0.25rem', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t} className={`bd-tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)} style={{ textTransform: 'capitalize' }}>{t}</button>
          ))}
        </div>

        {/* Overview */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {[
                { val: `₮${selectedBiz?.trust_score ?? 0}`, lbl: 'Trust Score', color: '#38bdf8' },
                { val: selectedBiz?.follower_count ?? 0, lbl: 'Followers', color: '#a78bfa' },
                { val: stats.totalListings, lbl: 'Active Listings', color: '#34d399' },
                { val: stats.teamCount, lbl: 'Team Members', color: '#fbbf24' },
                { val: stats.reviewCount, lbl: 'Reviews', color: '#fb923c' },
                { val: stats.avgRating > 0 ? `★${stats.avgRating}` : '—', lbl: 'Avg Rating', color: '#f472b6' },
              ].map(s => (
                <div key={s.lbl} className="bd-stat">
                  <div className="bd-stat-val" style={{ color: s.color }}>{s.val}</div>
                  <div className="bd-stat-lbl">{s.lbl}</div>
                </div>
              ))}
            </div>

            {/* Verification banner */}
            {selectedBiz && !selectedBiz.verified && (
              <div style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#fbbf24', marginBottom: '0.2rem' }}>🔒 Get Verified</div>
                  <div style={{ fontSize: '0.8rem', color: '#92400e' }}>Verified businesses get a badge, higher trust scores, and more visibility</div>
                </div>
                <button onClick={() => setActiveTab('verification')} style={{ background: '#fbbf24', border: 'none', borderRadius: 8, padding: '0.55rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>
                  Apply Now →
                </button>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'Add a Service', icon: '✨', href: '/seller/gigs/create' },
                { label: 'Create a Product', icon: '📦', href: '/seller/products/create' },
                { label: 'Post a Job', icon: '💼', href: '/jobs/new' },
                { label: 'Create an Event', icon: '📅', href: '/events/create' },
              ].map(a => (
                <Link key={a.label} href={a.href} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 12, padding: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: '#f1f5f9', fontSize: '0.88rem', fontWeight: 600, transition: 'border-color 0.12s' }}>
                  <span style={{ fontSize: '1.3rem' }}>{a.icon}</span> {a.label}
                </Link>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'verification' && (
          <div style={{ maxWidth: 600 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem' }}>Business Verification</h2>
            {selectedBiz?.verified ? (
              <div style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', borderRadius: 12, padding: '1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>✅</div>
                <div style={{ fontWeight: 700, color: '#34d399', marginBottom: '0.25rem' }}>Your business is verified!</div>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Verified badge appears on your profile and listings</div>
              </div>
            ) : (
              <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.5rem' }}>
                <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.7, marginTop: 0 }}>
                  Submitting your business documents for verification unlocks:
                </p>
                <ul style={{ color: '#cbd5e1', fontSize: '0.85rem', paddingLeft: '1.25rem', lineHeight: 2, marginBottom: '1.5rem' }}>
                  <li>✓ Verified business badge on profile and listings</li>
                  <li>✓ +50 Trust Score boost</li>
                  <li>✓ Priority placement in directory</li>
                  <li>✓ Access to business-only features</li>
                </ul>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Upload Business Registration Document</label>
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ background: '#0f172a', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 8, padding: '0.6rem', fontSize: '0.85rem', color: '#94a3b8' }} />
                  <button style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 10, padding: '0.75rem', fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', cursor: 'pointer' }}>
                    Submit for Verification
                  </button>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.75rem', marginBottom: 0 }}>
                  Documents are reviewed within 2-3 business days. You'll receive an email when approved.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'team' && (
          <div style={{ maxWidth: 700 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Team Members</h2>
              <button style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.82rem', color: '#38bdf8', cursor: 'pointer' }}>
                + Invite Member
              </button>
            </div>
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 12, padding: '1.25rem' }}>
              <p style={{ color: '#64748b', fontSize: '0.88rem', textAlign: 'center', margin: 0 }}>
                Invite team members via email — they'll appear here once they join
              </p>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Business Analytics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              {[
                { val: '—', lbl: 'Profile Views', sub: 'This month' },
                { val: `£${stats.totalRevenue.toFixed(0)}`, lbl: 'Revenue', sub: 'All time' },
                { val: stats.activeOrders, lbl: 'Active Orders', sub: 'In progress' },
              ].map(s => (
                <div key={s.lbl} className="bd-stat">
                  <div className="bd-stat-val">{s.val}</div>
                  <div className="bd-stat-lbl">{s.lbl}</div>
                  <div style={{ fontSize: '0.7rem', color: '#475569', marginTop: 2 }}>{s.sub}</div>
                </div>
              ))}
            </div>
            <Link href="/analytics" style={{ display: 'inline-block', color: '#38bdf8', fontSize: '0.85rem', textDecoration: 'none' }}>
              View full analytics →
            </Link>
          </div>
        )}

        {activeTab === 'listings' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Listings</h2>
              <Link href="/seller/gigs/create" style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 8, padding: '0.55rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}>
                + New Listing
              </Link>
            </div>
            <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 12, padding: '1.25rem', textAlign: 'center', color: '#64748b', fontSize: '0.88rem' }}>
              {stats.totalListings > 0 ? `${stats.totalListings} active listings` : 'No listings yet'}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
