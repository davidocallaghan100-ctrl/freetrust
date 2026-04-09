'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Avatar from '@/components/Avatar'

// ── Types ─────────────────────────────────────────────────────────────────────

type MemberType = 'individual' | 'organisation'
type FilterKey = 'all' | 'individual' | 'organisation' | 'verified'

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

interface Organisation {
  id: string
  type: 'organisation'
  name: string
  logo_url: string | null
  description: string | null
  category: string | null
  location: string | null
  trust_balance?: number | null
  verified: boolean
  services: string[]
  follower_count: number | null
}

type DirectoryItem = Member | Organisation

// ── Trust level badge ─────────────────────────────────────────────────────────

function TrustBadge({ score }: { score: number | null | undefined }) {
  if (!score || score <= 0) return null
  const color = score >= 5000 ? '#f59e0b' : score >= 1000 ? '#a78bfa' : score >= 500 ? '#34d399' : score >= 100 ? '#38bdf8' : '#94a3b8'
  return (
    <span style={{ fontSize: '11px', fontWeight: 700, color, background: `${color}15`, padding: '2px 7px', borderRadius: '20px', border: `1px solid ${color}30` }}>
      ₮{score.toLocaleString()}
    </span>
  )
}

// ── Member card ───────────────────────────────────────────────────────────────

function MemberCard({ member, onFollow }: { member: Member; onFollow: (id: string) => void }) {
  const [following, setFollowing] = useState(false)

  const handleFollow = async () => {
    const prev = following; setFollowing(!prev)
    try {
      await fetch('/api/connections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUserId: member.id }) })
      onFollow(member.id)
    } catch { setFollowing(prev) }
  }

  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', transition: 'border-color 0.15s' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <Link href={`/profile?id=${member.id}`} style={{ flexShrink: 0 }}>
          <Avatar url={member.avatar_url} name={member.full_name} size={48} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <Link href={`/profile?id=${member.id}`} style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', textDecoration: 'none' }}>
              {member.full_name ?? 'Unknown'}
            </Link>
            <TrustBadge score={member.trust_balance} />
          </div>
          {member.username && <div style={{ fontSize: '11px', color: '#475569' }}>@{member.username}</div>}
          {member.location && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>📍 {member.location}</div>}
        </div>
        <button
          onClick={handleFollow}
          style={{
            padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
            fontFamily: 'inherit', background: following ? 'rgba(56,189,248,0.1)' : '#38bdf8',
            color: following ? '#38bdf8' : '#0f172a', flexShrink: 0, transition: 'all 0.15s',
          }}
        >
          {following ? 'Following' : 'Follow'}
        </button>
      </div>

      {member.bio && (
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {member.bio}
        </p>
      )}

      {member.skills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {member.skills.slice(0, 4).map(skill => (
            <span key={skill} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(56,189,248,0.08)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.15)' }}>
              {skill}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#475569', borderTop: '1px solid #1e293b', paddingTop: '8px', marginTop: '2px' }}>
        <span>👥 {member.follower_count ?? 0} followers</span>
        <Link href={`/profile?id=${member.id}`} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>View profile →</Link>
      </div>
    </div>
  )
}

// ── Org card ──────────────────────────────────────────────────────────────────

function OrgCard({ org }: { org: Organisation }) {
  return (
    <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <Link href={`/organisations/${org.id}`} style={{ flexShrink: 0 }}>
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} style={{ width: '48px', height: '48px', borderRadius: '10px', objectFit: 'cover', border: '1px solid #334155' }} />
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: 'linear-gradient(135deg, #38bdf8, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 700, color: '#fff' }}>
              {(org.name?.[0] ?? 'O').toUpperCase()}
            </div>
          )}
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <Link href={`/organisations/${org.id}`} style={{ fontSize: '14px', fontWeight: 700, color: '#f1f5f9', textDecoration: 'none' }}>
              {org.name}
            </Link>
            {org.verified && <span style={{ fontSize: '10px', background: 'rgba(52,211,153,0.15)', color: '#34d399', padding: '1px 6px', borderRadius: '20px', fontWeight: 700 }}>✓ Verified</span>}
            <TrustBadge score={org.trust_balance} />
          </div>
          {org.category && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>🏷 {org.category}</div>}
          {org.location && <div style={{ fontSize: '11px', color: '#64748b' }}>📍 {org.location}</div>}
        </div>
      </div>

      {org.description && (
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {org.description}
        </p>
      )}

      {org.services.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {org.services.slice(0, 4).map(s => (
            <span key={s} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '20px', background: 'rgba(52,211,153,0.08)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }}>
              {s}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#475569', borderTop: '1px solid #1e293b', paddingTop: '8px', marginTop: '2px' }}>
        <span>👥 {org.follower_count ?? 0} followers</span>
        <Link href={`/organisations/${org.id}`} style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>View org →</Link>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DirectoryPage() {
  const [items,   setItems]   = useState<DirectoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [query,   setQuery]   = useState('')
  const [filter,  setFilter]  = useState<FilterKey>('all')
  const [location, setLocation] = useState('')

  const FILTERS: { key: FilterKey; label: string; icon: string }[] = [
    { key: 'all',          label: 'Everyone',      icon: '🌐' },
    { key: 'individual',   label: 'Individuals',   icon: '👤' },
    { key: 'organisation', label: 'Organisations', icon: '🏢' },
    { key: 'verified',     label: 'Verified',      icon: '✅' },
  ]

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [membersRes, orgsRes] = await Promise.all([
        fetch('/api/directory/members'),
        fetch('/api/directory/orgs'),
      ])
      const members: Member[] = membersRes.ok ? ((await membersRes.json()).members ?? []) : []
      const orgs: Organisation[] = orgsRes.ok ? ((await orgsRes.json()).orgs ?? []) : []
      setItems([...members, ...orgs])
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = items.filter(item => {
    const q = query.toLowerCase()
    const matchesQuery = !q || (
      ('full_name' in item ? item.full_name?.toLowerCase().includes(q) : item.name?.toLowerCase().includes(q)) ||
      ('bio' in item ? item.bio?.toLowerCase().includes(q) : item.description?.toLowerCase().includes(q)) ||
      item.location?.toLowerCase().includes(q) ||
      ('skills' in item ? item.skills?.some(s => s.toLowerCase().includes(q)) : item.services?.some(s => s.toLowerCase().includes(q)))
    )
    const matchesLocation = !location || item.location?.toLowerCase().includes(location.toLowerCase())
    const matchesFilter = filter === 'all' ? true
      : filter === 'individual' ? item.type === 'individual'
      : filter === 'organisation' ? item.type === 'organisation'
      : filter === 'verified' ? ('verified' in item ? item.verified : (item as Member).trust_balance !== null && (item as Member).trust_balance! >= 100)
      : true
    return matchesQuery && matchesLocation && matchesFilter
  })

  const individuals   = filtered.filter(i => i.type === 'individual') as Member[]
  const organisations = filtered.filter(i => i.type === 'organisation') as Organisation[]

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px 16px 80px' }}>

        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 4px' }}>Directory</h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>Discover members, creators, and organisations on FreeTrust</p>
        </div>

        {/* Search + Location */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: '180px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', color: '#64748b', pointerEvents: 'none' }}>🔍</span>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, skills, services…"
              style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '10px 14px 10px 36px', fontSize: '13px', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#38bdf8')}
              onBlur={e => (e.target.style.borderColor = '#334155')}
            />
          </div>
          <div style={{ flex: 1, minWidth: '140px', position: 'relative' }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', color: '#64748b', pointerEvents: 'none' }}>📍</span>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Location…"
              style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: '10px', padding: '10px 14px 10px 34px', fontSize: '13px', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box' }}
              onFocus={e => (e.target.style.borderColor = '#38bdf8')}
              onBlur={e => (e.target.style.borderColor = '#334155')}
            />
          </div>
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '20px', border: 'none',
                cursor: 'pointer', fontSize: '12px', fontWeight: filter === f.key ? 700 : 500, fontFamily: 'inherit',
                background: filter === f.key ? '#38bdf8' : 'rgba(56,189,248,0.06)',
                color: filter === f.key ? '#0f172a' : '#64748b',
                transition: 'all 0.15s',
              }}
            >
              {f.icon} {f.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: '3px solid #1e293b', borderTopColor: '#38bdf8', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
            Loading directory…
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
            <div style={{ fontSize: '16px', color: '#94a3b8', marginBottom: '6px' }}>No results found</div>
            <div style={{ fontSize: '13px' }}>Try adjusting your search or filters</div>
          </div>
        ) : (
          <>
            {/* Individuals section */}
            {(filter === 'all' || filter === 'individual' || filter === 'verified') && individuals.length > 0 && (
              <section style={{ marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '16px' }}>👤</span>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8', margin: 0 }}>
                    Members <span style={{ color: '#475569', fontWeight: 400 }}>({individuals.length})</span>
                  </h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {individuals.map(m => (
                    <MemberCard key={m.id} member={m} onFollow={() => {}} />
                  ))}
                </div>
              </section>
            )}

            {/* Organisations section */}
            {(filter === 'all' || filter === 'organisation' || filter === 'verified') && organisations.length > 0 && (
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '16px' }}>🏢</span>
                  <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#94a3b8', margin: 0 }}>
                    Organisations <span style={{ color: '#475569', fontWeight: 400 }}>({organisations.length})</span>
                  </h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                  {organisations.map(o => (
                    <OrgCard key={o.id} org={o} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
