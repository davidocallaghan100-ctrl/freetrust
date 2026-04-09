'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Business {
  id: string
  name: string
  slug: string
  business_type: string
  industry: string
  description: string
  mission: string
  logo_url: string | null
  cover_url: string | null
  website: string | null
  social_links: Record<string, string>
  location: string | null
  service_area: string | null
  contact_email: string | null
  contact_phone: string | null
  vat_number: string | null
  founded_date: string | null
  verified: boolean
  verification_status: string
  trust_score: number
  follower_count: number
  created_at: string
  tagline?: string | null
  tags?: string[]
  size?: string | null
  owner: { id: string; full_name: string; avatar_url: string | null }
  members: Array<{ id: string; role: string; title: string; user: { id: string; full_name: string; avatar_url: string | null } }>
  reviews: Array<{ id: string; rating: number; content: string; created_at: string; reviewer: { id: string; full_name: string; avatar_url: string | null } }>
}

function getGrad(str: string) {
  const grads = ['linear-gradient(135deg,#38bdf8,#0284c7)','linear-gradient(135deg,#a78bfa,#7c3aed)','linear-gradient(135deg,#34d399,#059669)','linear-gradient(135deg,#fb923c,#ea580c)']
  return grads[(str.charCodeAt(0) ?? 0) % grads.length]
}
function initials(name: string) { return name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() }

export default function BusinessProfilePage() {
  const params = useParams()
  const id = params?.id as string
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('about')
  const [following, setFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [listings, setListings] = useState<Array<{id: string; title: string; price: number; currency: string}>>([])

  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)

      try {
        const res = await fetch(`/api/businesses/${id}`)
        const json = await res.json()
        if (json.business) {
          setBusiness(json.business)
          setFollowerCount(json.business.follower_count ?? 0)
        }
      } catch {}

      // Load listings
      try {
        const { data } = await supabase
          .from('listings')
          .select('id, title, price, currency')
          .eq('business_id', id)
          .eq('status', 'active')
          .limit(6)
        if (data) setListings(data)
      } catch {}

      setLoading(false)
    }
    if (id) load()
  }, [id])

  const handleFollow = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const wasFollowing = following
    setFollowing(!wasFollowing)
    setFollowerCount(c => wasFollowing ? c - 1 : c + 1)
    if (wasFollowing) {
      await supabase.from('business_followers').delete().eq('business_id', id).eq('user_id', user.id)
    } else {
      await supabase.from('business_followers').insert({ business_id: id, user_id: user.id })
    }
  }

  const copyProfileLink = () => {
    navigator.clipboard.writeText(window.location.href)
  }

  if (loading) return (
    <div style={{ minHeight: 'calc(100vh - 104px)', paddingTop: 64, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
      Loading…
    </div>
  )
  if (!business) return (
    <div style={{ minHeight: 'calc(100vh - 104px)', paddingTop: 64, background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
      Business not found
    </div>
  )

  const avgRating = business.reviews.length
    ? (business.reviews.reduce((s, r) => s + r.rating, 0) / business.reviews.length).toFixed(1)
    : null
  const isOwner = currentUserId === business.owner?.id
  const TABS = ['about', 'services', 'team', 'reviews']

  return (
    <div style={{ minHeight: 'calc(100vh - 104px)', paddingTop: 64, background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .biz-tab { padding: 0.6rem 1.1rem; border-radius: 8px; background: transparent; border: none; cursor: pointer; font-size: 0.85rem; color: #64748b; transition: all 0.12s; }
        .biz-tab.active { background: rgba(56,189,248,0.1); color: #38bdf8; font-weight: 600; }
        .biz-tab:hover { color: #f1f5f9; }
        .biz-stat { text-align: center; }
        .biz-stat-val { font-size: 1.3rem; font-weight: 800; color: #f1f5f9; }
        .biz-stat-lbl { font-size: 0.72rem; color: #64748b; margin-top: 2px; }
      `}</style>

      {/* Cover */}
      <div style={{ height: 180, background: business.cover_url ? `url(${business.cover_url}) center/cover` : 'linear-gradient(135deg,rgba(56,189,248,0.12),rgba(129,140,248,0.08))', position: 'relative', borderBottom: '1px solid rgba(56,189,248,0.08)' }}>
        {isOwner && (
          <Link href={`/dashboard/business?id=${id}`} style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.4rem 0.85rem', fontSize: '0.8rem', color: '#38bdf8', textDecoration: 'none' }}>
            ✏️ Edit
          </Link>
        )}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 1rem' }}>
        {/* Logo + header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', marginTop: -40, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div style={{ width: 80, height: 80, borderRadius: 16, border: '3px solid #0f172a', overflow: 'hidden', background: business.logo_url ? `url(${business.logo_url}) center/cover` : getGrad(business.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', flexShrink: 0 }}>
            {!business.logo_url && initials(business.name)}
          </div>
          <div style={{ flex: 1, paddingBottom: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>{business.name}</h1>
              {business.verified && (
                <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', fontWeight: 700 }}>
                  ✓ Verified
                </span>
              )}
            </div>
            {business.tagline && (
              <p style={{ fontSize: '0.9rem', color: '#94a3b8', margin: '0.25rem 0 0', fontStyle: 'italic' }}>{business.tagline}</p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{business.business_type}</span>
              {business.industry && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>· {business.industry}</span>}
              {business.location && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>· 📍 {business.location}</span>}
              {business.size && <span style={{ fontSize: '0.8rem', color: '#64748b' }}>· {business.size}</span>}
            </div>
            {business.tags && business.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {business.tags.map(tag => (
                  <span key={tag} style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.7rem', color: '#7dd3fc' }}>
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', gap: '0.5rem', paddingBottom: '0.25rem' }}>
            <button onClick={handleFollow} style={{ background: following ? 'rgba(56,189,248,0.1)' : 'linear-gradient(135deg,#38bdf8,#0284c7)', border: following ? '1px solid rgba(56,189,248,0.3)' : 'none', borderRadius: 8, padding: '0.55rem 1.1rem', fontSize: '0.85rem', fontWeight: 700, color: following ? '#38bdf8' : '#0f172a', cursor: 'pointer' }}>
              {following ? '✓ Following' : '+ Follow'}
            </button>
            {business.contact_email && (
              <a href={`mailto:${business.contact_email}`} style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.55rem 1.1rem', fontSize: '0.85rem', color: '#94a3b8', textDecoration: 'none', fontWeight: 600 }}>
                ✉️ Contact
              </a>
            )}
            <button onClick={copyProfileLink} style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.55rem 0.9rem', fontSize: '0.85rem', color: '#94a3b8', cursor: 'pointer' }}>
              🔗
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '2rem', padding: '1rem 0', borderTop: '1px solid rgba(56,189,248,0.07)', borderBottom: '1px solid rgba(56,189,248,0.07)', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div className="biz-stat"><div className="biz-stat-val">₮{business.trust_score.toLocaleString()}</div><div className="biz-stat-lbl">Trust Score</div></div>
          <div className="biz-stat"><div className="biz-stat-val">{followerCount}</div><div className="biz-stat-lbl">Followers</div></div>
          {avgRating && <div className="biz-stat"><div className="biz-stat-val">★ {avgRating}</div><div className="biz-stat-lbl">Rating ({business.reviews.length})</div></div>}
          {business.members.length > 0 && <div className="biz-stat"><div className="biz-stat-val">{business.members.length}</div><div className="biz-stat-lbl">Team Members</div></div>}
          {business.founded_date && <div className="biz-stat"><div className="biz-stat-val">{new Date(business.founded_date).getFullYear()}</div><div className="biz-stat-lbl">Founded</div></div>}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid rgba(56,189,248,0.07)', paddingBottom: '0.25rem' }}>
          {TABS.map(t => (
            <button key={t} className={`biz-tab${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)} style={{ textTransform: 'capitalize' }}>
              {t}
              {t === 'reviews' && business.reviews.length > 0 && <span style={{ marginLeft: 5, background: 'rgba(56,189,248,0.12)', borderRadius: 999, padding: '0.05rem 0.45rem', fontSize: '0.7rem', color: '#38bdf8' }}>{business.reviews.length}</span>}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'about' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
            {business.description && (
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.6rem', color: '#94a3b8' }}>About</h3>
                <p style={{ color: '#cbd5e1', lineHeight: 1.7, margin: 0, fontSize: '0.92rem' }}>{business.description}</p>
              </div>
            )}
            {business.mission && (
              <div style={{ background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.1rem' }}>
                <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.5rem' }}>Our Mission</h3>
                <p style={{ color: '#cbd5e1', lineHeight: 1.7, margin: 0, fontSize: '0.9rem', fontStyle: 'italic' }}>"{business.mission}"</p>
              </div>
            )}
            {/* Links */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {business.website && <a href={business.website} target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.45rem 0.9rem', fontSize: '0.8rem', color: '#94a3b8', textDecoration: 'none' }}>🌐 Website</a>}
              {Object.entries(business.social_links ?? {}).filter(([, v]) => v).map(([k, v]) => (
                <a key={k} href={v.startsWith('http') ? v : `https://${v}`} target="_blank" rel="noopener noreferrer" style={{ background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 8, padding: '0.45rem 0.9rem', fontSize: '0.8rem', color: '#94a3b8', textDecoration: 'none', textTransform: 'capitalize' }}>{k}</a>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'services' && (
          <div style={{ paddingBottom: '3rem' }}>
            {listings.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                {listings.map(l => (
                  <Link key={l.id} href={`/services/${l.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1rem', transition: 'border-color 0.15s' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f1f5f9', marginBottom: '0.5rem' }}>{l.title}</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38bdf8' }}>{l.currency}{l.price}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📋</div>
                <p>No services listed yet</p>
                {isOwner && <Link href="/seller/gigs/create" style={{ color: '#38bdf8', fontSize: '0.88rem' }}>Add your first service →</Link>}
              </div>
            )}
          </div>
        )}

        {activeTab === 'team' && (
          <div style={{ paddingBottom: '3rem' }}>
            {business.members.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {business.members.map(m => (
                  <Link key={m.id} href={`/profile/${m.user.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 12, padding: '1.1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: m.user.avatar_url ? `url(${m.user.avatar_url}) center/cover` : getGrad(m.user.full_name ?? ''), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
                        {!m.user.avatar_url && initials(m.user.full_name ?? '?')}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#f1f5f9' }}>{m.user.full_name}</div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{m.title || m.role}</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>👥</div>
                <p>No team members added yet</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reviews' && (
          <div style={{ paddingBottom: '3rem' }}>
            {business.reviews.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {business.reviews.map(r => (
                  <div key={r.id} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 12, padding: '1.1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: getGrad(r.reviewer.full_name ?? ''), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#0f172a', flexShrink: 0 }}>
                        {initials(r.reviewer.full_name ?? '?')}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9' }}>{r.reviewer.full_name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                      </div>
                      <div style={{ fontSize: '1rem', color: '#fbbf24' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                    </div>
                    {r.content && <p style={{ color: '#cbd5e1', fontSize: '0.88rem', lineHeight: 1.6, margin: 0 }}>{r.content}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⭐</div>
                <p>No reviews yet</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
