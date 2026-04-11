'use client'
import React, { useState, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Member {
  id: string
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  location: string | null
  role: string | null
  trust_balance: number
  skills?: string[]
  verified?: boolean
  online?: boolean
}

const GRADIENTS = [
  'linear-gradient(135deg,#38bdf8,#0284c7)',
  'linear-gradient(135deg,#f472b6,#db2777)',
  'linear-gradient(135deg,#34d399,#059669)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#fbbf24,#d97706)',
  'linear-gradient(135deg,#fb923c,#ea580c)',
]
function grad(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return GRADIENTS[h % GRADIENTS.length]
}
function initials(name: string | null) {
  if (!name) return '?'
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2)
}


const TYPE_FILTERS = ['All', 'Services', 'Products', 'Events']
const MODE_FILTERS = ['Online', 'Local']
const BADGE_FILTERS = ['Verified']

function MemberCard({ member }: { member: Member }) {
  const [followed, setFollowed] = useState(false)

  return (
    <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, padding: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem', transition: 'transform 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 6px 24px rgba(56,189,248,0.12)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow='' }}>

      {/* Top row: avatar + name + online dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          {member.avatar_url
            ? <img src={member.avatar_url} alt={member.full_name ?? ''} style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(56,189,248,0.2)' }} />
            : <div style={{ width: 50, height: 50, borderRadius: '50%', background: grad(member.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 800, color: '#fff', border: '2px solid rgba(56,189,248,0.2)' }}>{initials(member.full_name)}</div>
          }
          {member.online && (
            <div style={{ position: 'absolute', bottom: 2, right: 2, width: 10, height: 10, borderRadius: '50%', background: '#34d399', border: '2px solid #1e293b' }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.full_name ?? 'Member'}</span>
            {member.verified && <span title="Verified" style={{ color: '#38bdf8', fontSize: '0.75rem', flexShrink: 0 }}>✓</span>}
          </div>
          {member.role && <div style={{ fontSize: '0.75rem', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.role}</div>}
        </div>
      </div>

      {/* Trust + location row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 7, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 700, color: '#38bdf8' }}>
          ₮{member.trust_balance.toLocaleString()}
        </span>
        {member.location && (
          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <span>📍</span><span>{member.location}</span>
          </span>
        )}
      </div>

      {/* Bio */}
      {member.bio && (
        <p style={{ fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.55, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {member.bio}
        </p>
      )}

      {/* Skills pills */}
      {member.skills && member.skills.length > 0 && (
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {member.skills.slice(0, 3).map(s => (
            <span key={s} style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '2px 8px', fontSize: '0.68rem', color: '#94a3b8', fontWeight: 500 }}>{s}</span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
        <Link href={`/messages?to=${member.id}`} style={{ flex: 1, background: 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 9, padding: '0.55rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: '#fff', cursor: 'pointer', textAlign: 'center', textDecoration: 'none', minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          Collab
        </Link>
        <button
          onClick={() => setFollowed(f => !f)}
          style={{ flex: 1, background: followed ? 'rgba(56,189,248,0.15)' : 'transparent', border: `1px solid ${followed ? 'rgba(56,189,248,0.4)' : 'rgba(148,163,184,0.25)'}`, borderRadius: 9, padding: '0.55rem 0.75rem', fontSize: '0.8rem', fontWeight: 700, color: followed ? '#38bdf8' : '#94a3b8', cursor: 'pointer', minHeight: 44 }}>
          {followed ? 'Following' : 'Follow'}
        </button>
      </div>
    </div>
  )
}

// ─── Inner component (uses useSearchParams) ───────────────────────────────────
function CollabPeopleInner() {
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [typeFilter, setTypeFilter] = useState('All')
  const [showOnline, setShowOnline] = useState(false)
  const [showLocal, setShowLocal] = useState(false)
  const [showVerified, setShowVerified] = useState(false)
  const [dbMembers, setDbMembers] = useState<Member[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 12

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, bio, location, role, created_at')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(100)
        if (profiles && profiles.length > 0) {
          const ids = profiles.map((p: Record<string, unknown>) => p.id as string)
          const { data: balances } = await supabase
            .from('trust_balances')
            .select('user_id, balance')
            .in('user_id', ids)
          const balanceMap: Record<string, number> = {}
          for (const b of balances ?? []) balanceMap[(b as Record<string, unknown>).user_id as string] = Number((b as Record<string, unknown>).balance ?? 0)
          setDbMembers(profiles.map((m: Record<string, unknown>) => ({
            id: String(m.id),
            full_name: m.full_name as string | null,
            avatar_url: m.avatar_url as string | null,
            bio: m.bio as string | null,
            location: m.location as string | null,
            role: m.role as string | null,
            trust_balance: balanceMap[String(m.id)] ?? 0,
          })).sort((a, b) => b.trust_balance - a.trust_balance))
        }
      } catch { /* use mock */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const members = dbMembers ?? []

  const filtered = members.filter(m => {
    const q = search.toLowerCase()
    if (q && !m.full_name?.toLowerCase().includes(q) && !m.role?.toLowerCase().includes(q) && !m.bio?.toLowerCase().includes(q) && !m.skills?.some(s => s.toLowerCase().includes(q))) return false
    if (showOnline && !m.online) return false
    if (showVerified && !m.verified) return false
    return true
  })

  const paginated = filtered.slice(0, page * PAGE_SIZE)
  const hasMore = paginated.length < filtered.length

  const pillActive = (active: boolean) => ({
    padding: '0.4rem 0.9rem', borderRadius: 999, fontSize: '0.8rem', fontWeight: active ? 700 : 500,
    cursor: 'pointer', border: `1px solid ${active ? '#38bdf8' : 'rgba(148,163,184,0.2)'}`,
    background: active ? 'rgba(56,189,248,0.12)' : 'transparent', color: active ? '#38bdf8' : '#94a3b8',
    whiteSpace: 'nowrap' as const, minHeight: 36,
  })

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64, paddingBottom: 80 }}>
      <style>{`
        .collab-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 1.1rem; }
        .collab-filter-row { display: flex; gap: 0.5rem; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; flex-wrap: wrap; }
        .collab-filter-row::-webkit-scrollbar { display: none; }
        @media (max-width: 1200px) { .collab-grid { grid-template-columns: repeat(3,1fr) !important; } }
        @media (max-width: 900px)  { .collab-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 540px)  { .collab-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.25rem 2rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.2rem)', fontWeight: 900, margin: '0 0 0.25rem', letterSpacing: '-0.5px' }}>Find Collaborators</h1>
          <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>Connect with trusted members for your next project</p>
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: '1rem', pointerEvents: 'none' }}>🔍</span>
          <input
            type="search"
            placeholder="Search by name, skill or role…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            style={{ width: '100%', background: '#1e293b', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 10, padding: '0.65rem 1rem 0.65rem 2.5rem', fontSize: '0.9rem', color: '#f1f5f9', outline: 'none', boxSizing: 'border-box', minHeight: 44 }}
          />
        </div>

        {/* Filter pills */}
        <div className="collab-filter-row" style={{ marginBottom: '1.25rem' }}>
          {TYPE_FILTERS.map(f => (
            <button key={f} onClick={() => setTypeFilter(f)} style={pillActive(typeFilter === f)}>{f}</button>
          ))}
          <button onClick={() => setShowOnline(v => !v)} style={pillActive(showOnline)}>💻 Online</button>
          <button onClick={() => setShowLocal(v => !v)} style={pillActive(showLocal)}>📍 Local</button>
          <button onClick={() => setShowVerified(v => !v)} style={pillActive(showVerified)}>✓ Verified</button>
        </div>

        {/* Count */}
        <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '1rem' }}>
          {loading ? 'Loading…' : `${filtered.length} collaborator${filtered.length !== 1 ? 's' : ''} found`}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="collab-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} style={{ background: '#1e293b', borderRadius: 14, height: 220, opacity: 0.5 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🤝</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>No collaborators found</h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>
              {search ? `No one matching "${search}" — try a different search or expand your filters.` : 'Try adjusting your filters or expanding your search radius.'}
            </p>
            <button onClick={() => { setSearch(''); setTypeFilter('All'); setShowOnline(false); setShowVerified(false) }}
              style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 9, padding: '0.65rem 1.5rem', color: '#38bdf8', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}>
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <div className="collab-grid">
              {paginated.map(m => <MemberCard key={m.id} member={m} />)}
            </div>
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                <button onClick={() => setPage(p => p + 1)}
                  style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 10, padding: '0.75rem 2rem', color: '#38bdf8', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', minHeight: 44 }}>
                  Load more ({filtered.length - paginated.length} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function CollabPeoplePage() {
  return (
    <Suspense fallback={<div style={{ paddingTop: 64, textAlign: 'center', color: '#64748b' }}>Loading…</div>}>
      <CollabPeopleInner />
    </Suspense>
  )
}
