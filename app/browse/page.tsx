'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Avatar from '@/components/Avatar'

// ── Types ─────────────────────────────────────────────────────────────────────

type TabKey = 'all' | 'members' | 'businesses' | 'organisations'
type FilterKey = 'all' | 'verified'

interface Member {
  id: string
  type: 'individual'
  full_name: string | null
  username: string | null
  avatar_url: string | null
  bio: string | null
  location: string | null
  trust_balance: number | null
  skills: string[]
  follower_count: number | null
}

interface Business {
  id: string
  type: 'business'
  name: string
  slug: string | null
  business_type: string | null
  industry: string | null
  description: string | null
  logo_url: string | null
  location: string | null
  verified: boolean
  follower_count: number | null
  trust_score: number | null
}

interface Organisation {
  id: string
  type: 'organisation'
  name: string
  logo_url: string | null
  description: string | null
  category: string | null
  location: string | null
  verified: boolean
  services: string[]
  follower_count: number | null
}

// ── Trust badge ───────────────────────────────────────────────────────────────

function TrustBadge({ score }: { score: number | null | undefined }) {
  if (!score || score <= 0) return null
  const color = score >= 5000 ? '#f59e0b' : score >= 1000 ? '#a78bfa' : score >= 500 ? '#34d399' : score >= 100 ? '#38bdf8' : '#94a3b8'
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, color, background: `${color}18`, padding: '2px 6px', borderRadius: '20px', border: `1px solid ${color}28`, whiteSpace: 'nowrap' }}>
      ₮{score.toLocaleString()}
    </span>
  )
}

// ── Cards ─────────────────────────────────────────────────────────────────────

function MemberCard({ member }: { member: Member }) {
  const [following, setFollowing] = useState(false)
  const follow = async () => {
    const prev = following; setFollowing(!prev)
    try { await fetch('/api/connections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUserId: member.id }) }) }
    catch { setFollowing(prev) }
  }
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <Link href={`/profile?id=${member.id}`} style={{ flexShrink: 0 }}>
          <Avatar url={member.avatar_url} name={member.full_name} size={44} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <Link href={`/profile?id=${member.id}`} style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>
              {member.full_name ?? 'Unknown'}
            </Link>
            <TrustBadge score={member.trust_balance} />
          </div>
          {member.username && <div style={{ fontSize: '11px', color: '#475569' }}>@{member.username}</div>}
          {member.location && <div style={{ fontSize: '11px', color: '#64748b' }}>📍 {member.location}</div>}
        </div>
        <button
          onClick={follow}
          style={{ padding: '5px 11px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'inherit', background: following ? 'rgba(56,189,248,0.1)' : '#38bdf8', color: following ? '#38bdf8' : '#0f172a', flexShrink: 0, transition: 'all 0.15s' }}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      </div>
      {member.bio && (
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{member.bio}</p>
      )}
      {member.skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {member.skills.slice(0, 4).map(s => (
            <span key={s} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '20px', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.15)' }}>{s}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569', borderTop: '1px solid #1e293b', paddingTop: '8px' }}>
        <span>👥 {member.follower_count ?? 0} followers</span>
        <Link href={`/profile?id=${member.id}`} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>View →</Link>
      </div>
    </div>
  )
}

function BusinessCard({ biz }: { biz: Business }) {
  const [following, setFollowing] = useState(false)
  const follow = async () => {
    const prev = following; setFollowing(!prev)
    try { await fetch('/api/businesses/follow', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId: biz.id }) }) }
    catch { setFollowing(prev) }
  }
  const typeLabel: Record<string, string> = { sole_trader: 'Sole Trader', ltd: 'Ltd Company', llp: 'LLP', partnership: 'Partnership', nonprofit: 'Non-Profit', cooperative: 'Co-operative', freelancer: 'Freelancer', startup: 'Startup' }
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <Link href={`/business/${biz.id}`} style={{ flexShrink: 0 }}>
          {biz.logo_url ? (
            <img src={biz.logo_url} alt={biz.name} style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #334155' }} />
          ) : (
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg, #34d399, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: '#fff' }}>
              {(biz.name?.[0] ?? 'B').toUpperCase()}
            </div>
          )}
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <Link href={`/business/${biz.id}`} style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>{biz.name}</Link>
            {biz.verified && <span style={{ fontSize: '9px', background: 'rgba(52,211,153,0.15)', color: '#34d399', padding: '1px 5px', borderRadius: '20px', fontWeight: 700, whiteSpace: 'nowrap' }}>✓ Verified</span>}
            <TrustBadge score={biz.trust_score} />
          </div>
          {biz.business_type && <div style={{ fontSize: '11px', color: '#64748b' }}>🏷 {typeLabel[biz.business_type] ?? biz.business_type}</div>}
          {biz.location && <div style={{ fontSize: '11px', color: '#64748b' }}>📍 {biz.location}</div>}
        </div>
        <button
          onClick={follow}
          style={{ padding: '5px 11px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 700, fontFamily: 'inherit', background: following ? 'rgba(52,211,153,0.1)' : '#34d399', color: following ? '#34d399' : '#0f172a', flexShrink: 0, transition: 'all 0.15s' }}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      </div>
      {biz.description && (
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{biz.description}</p>
      )}
      {biz.industry && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '20px', background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }}>{biz.industry}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569', borderTop: '1px solid #1e293b', paddingTop: '8px' }}>
        <span>👥 {biz.follower_count ?? 0} followers</span>
        <Link href={`/business/${biz.id}`} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>View →</Link>
      </div>
    </div>
  )
}

function OrgCard({ org }: { org: Organisation }) {
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <Link href={`/organisations/${org.id}`} style={{ flexShrink: 0 }}>
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} style={{ width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #334155' }} />
          ) : (
            <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: 'linear-gradient(135deg, #38bdf8, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: '#fff' }}>
              {(org.name?.[0] ?? 'O').toUpperCase()}
            </div>
          )}
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <Link href={`/organisations/${org.id}`} style={{ fontSize: '13px', fontWeight: 700, color: '#f1f5f9', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>{org.name}</Link>
            {org.verified && <span style={{ fontSize: '9px', background: 'rgba(52,211,153,0.15)', color: '#34d399', padding: '1px 5px', borderRadius: '20px', fontWeight: 700, whiteSpace: 'nowrap' }}>✓ Verified</span>}
          </div>
          {org.category && <div style={{ fontSize: '11px', color: '#64748b' }}>🏷 {org.category}</div>}
          {org.location && <div style={{ fontSize: '11px', color: '#64748b' }}>📍 {org.location}</div>}
        </div>
      </div>
      {org.description && (
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{org.description}</p>
      )}
      {org.services.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {org.services.slice(0, 4).map(s => (
            <span key={s} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '20px', background: 'rgba(167,139,250,0.08)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.15)' }}>{s}</span>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#475569', borderTop: '1px solid #1e293b', paddingTop: '8px' }}>
        <span>👥 {org.follower_count ?? 0} followers</span>
        <Link href={`/organisations/${org.id}`} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>View →</Link>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DirectoryPage() {
  const [members,       setMembers]       = useState<Member[]>([])
  const [businesses,    setBusinesses]    = useState<Business[]>([])
  const [organisations, setOrganisations] = useState<Organisation[]>([])
  const [loading,       setLoading]       = useState(true)
  const [query,         setQuery]         = useState('')
  const [location,      setLocation]      = useState('')
  const [tab,           setTab]           = useState<TabKey>('all')
  const [filter,        setFilter]        = useState<FilterKey>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mRes, bRes, oRes] = await Promise.all([
        fetch('/api/directory/members'),
        fetch('/api/directory/businesses'),
        fetch('/api/directory/orgs'),
      ])
      setMembers(mRes.ok ? ((await mRes.json()).members ?? []) : [])
      setBusinesses(bRes.ok ? ((await bRes.json()).businesses ?? []) : [])
      setOrganisations(oRes.ok ? ((await oRes.json()).orgs ?? []) : [])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const matchItem = (item: any): boolean => {
    const q = query.toLowerCase()
    const name: string | null = item.full_name ?? item.name ?? null
    const desc: string | null = item.bio ?? item.description ?? null
    const tags: string[] = item.skills ?? item.services ?? []
    const loc: string | null = item.location ?? null
    const matchQ = !q || name?.toLowerCase().includes(q) || desc?.toLowerCase().includes(q) || tags.some((t: string) => t.toLowerCase().includes(q)) || loc?.toLowerCase().includes(q)
    const matchL = !location || loc?.toLowerCase().includes(location.toLowerCase())
    const matchV = filter !== 'verified' || item.verified === true
    return Boolean(matchQ && matchL && matchV)
  }

  const filteredMembers = members.filter(matchItem)
  const filteredBiz     = businesses.filter(matchItem)
  const filteredOrgs    = organisations.filter(matchItem)

  const totalCount = filteredMembers.length + filteredBiz.length + filteredOrgs.length

  const TABS = [
    { key: 'all' as TabKey,           label: 'All',           count: totalCount },
    { key: 'members' as TabKey,       label: 'Members',       count: filteredMembers.length },
    { key: 'businesses' as TabKey,    label: 'Businesses',    count: filteredBiz.length },
    { key: 'organisations' as TabKey, label: 'Organisations', count: filteredOrgs.length },
  ]

  const showMembers = tab === 'all' || tab === 'members'
  const showBiz     = tab === 'all' || tab === 'businesses'
  const showOrgs    = tab === 'all' || tab === 'organisations'

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <style>{`
        .dir-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
        .dir-tabs { display: flex; gap: 6px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; }
        .dir-tabs::-webkit-scrollbar { display: none; }
        .dir-tabs button { flex-shrink: 0; }
        @media (max-width: 600px) {
          .dir-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px 14px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: '16px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px' }}>Directory</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Members, businesses & organisations on FreeTrust</p>
        </div>

        {/* Search + Location */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: '160px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#64748b', pointerEvents: 'none' }}>🔍</span>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, skills, industry…"
              style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '10px 12px 10px 34px', fontSize: '13px', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#38bdf8')} onBlur={e => (e.target.style.borderColor = '#334155')} />
          </div>
          <div style={{ flex: 1, minWidth: '120px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: '#64748b', pointerEvents: 'none' }}>📍</span>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location…"
              style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '10px 12px 10px 32px', fontSize: '13px', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#38bdf8')} onBlur={e => (e.target.style.borderColor = '#334155')} />
          </div>
        </div>

        {/* Tabs + Verified toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '8px' }}>
          <div className="dir-tabs">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ padding: '6px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: tab === t.key ? 700 : 500, fontFamily: 'inherit', background: tab === t.key ? '#38bdf8' : 'rgba(56,189,248,0.06)', color: tab === t.key ? '#0f172a' : '#64748b', transition: 'all 0.15s' }}>
                {t.label} <span style={{ opacity: 0.7 }}>({t.count})</span>
              </button>
            ))}
          </div>
          <button onClick={() => setFilter(f => f === 'verified' ? 'all' : 'verified')}
            style={{ padding: '6px 12px', borderRadius: '20px', border: `1px solid ${filter === 'verified' ? '#34d399' : '#334155'}`, cursor: 'pointer', fontSize: '11px', fontWeight: 600, fontFamily: 'inherit', background: filter === 'verified' ? 'rgba(52,211,153,0.1)' : 'transparent', color: filter === 'verified' ? '#34d399' : '#64748b', flexShrink: 0, transition: 'all 0.15s' }}>
            ✓ Verified
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid #1e293b', borderTopColor: '#38bdf8', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            Loading directory…
          </div>
        ) : totalCount === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
            <div style={{ fontSize: '15px', color: '#94a3b8', marginBottom: '6px' }}>No results found</div>
            <div style={{ fontSize: '13px' }}>Try adjusting your search or filters</div>
          </div>
        ) : (
          <>
            {/* Members */}
            {showMembers && filteredMembers.length > 0 && (
              <section style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '15px' }}>👤</span>
                  <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8', margin: 0 }}>
                    Members <span style={{ color: '#475569', fontWeight: 400 }}>({filteredMembers.length})</span>
                  </h2>
                </div>
                <div className="dir-grid">
                  {filteredMembers.map(m => <MemberCard key={m.id} member={m} />)}
                </div>
              </section>
            )}

            {/* Businesses */}
            {showBiz && filteredBiz.length > 0 && (
              <section style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '15px' }}>🏢</span>
                  <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8', margin: 0 }}>
                    Businesses <span style={{ color: '#475569', fontWeight: 400 }}>({filteredBiz.length})</span>
                  </h2>
                  <Link href="/create-business" style={{ marginLeft: 'auto', fontSize: '11px', color: '#38bdf8', textDecoration: 'none', fontWeight: 600, flexShrink: 0 }}>+ Add yours</Link>
                </div>
                <div className="dir-grid">
                  {filteredBiz.map(b => <BusinessCard key={b.id} biz={b} />)}
                </div>
              </section>
            )}

            {/* Empty businesses CTA */}
            {showBiz && filteredBiz.length === 0 && !loading && (tab === 'businesses') && (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b', marginBottom: '28px' }}>
                <div style={{ fontSize: '36px', marginBottom: '10px' }}>🏢</div>
                <div style={{ fontSize: '14px', color: '#94a3b8', marginBottom: '6px' }}>No businesses yet</div>
                <Link href="/create-business" style={{ display: 'inline-block', marginTop: '10px', padding: '8px 20px', borderRadius: '8px', background: '#38bdf8', color: '#0f172a', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>Create a business profile</Link>
              </div>
            )}

            {/* Organisations */}
            {showOrgs && filteredOrgs.length > 0 && (
              <section style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '15px' }}>🌐</span>
                  <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8', margin: 0 }}>
                    Organisations <span style={{ color: '#475569', fontWeight: 400 }}>({filteredOrgs.length})</span>
                  </h2>
                </div>
                <div className="dir-grid">
                  {filteredOrgs.map(o => <OrgCard key={o.id} org={o} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
