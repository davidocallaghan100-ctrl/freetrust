'use client'
import React, { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CollabEvent {
  id: string
  title: string
  description: string
  starts_at: string
  ends_at: string | null
  is_online: boolean
  meeting_url: string | null
  attendee_count: number
  created_at: string
  community_id: string | null
  // Joined fields
  host_name?: string | null
  host_id?: string | null
  host_avatar?: string | null
  trust_balance?: number
  price?: number
  location?: string | null
}

const GRADIENTS = [
  'linear-gradient(135deg,#34d399,#059669)',
  'linear-gradient(135deg,#38bdf8,#0284c7)',
  'linear-gradient(135deg,#f472b6,#db2777)',
  'linear-gradient(135deg,#a78bfa,#7c3aed)',
  'linear-gradient(135deg,#fbbf24,#d97706)',
]
function grad(id: string) {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff
  return GRADIENTS[h % GRADIENTS.length]
}
function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function trustBadge(score: number) {
  if (score >= 500) return { label: 'Top Host', color: '#fbbf24' }
  if (score >= 200) return { label: 'Verified Host', color: '#34d399' }
  return { label: 'Host', color: '#38bdf8' }
}


function EventsContent() {
  const searchParams = useSearchParams()
  const [events, setEvents] = useState<CollabEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [minTrust, setMinTrust] = useState(0)
  const [freeOnly, setFreeOnly] = useState(false)
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [search, setSearch] = useState(searchParams.get('q') || '')

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('community_events')
        .select('*, communities(id, name)')
        .gte('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(50)

      if (error || !data || data.length === 0) {
        setEvents([])
      } else {
        // Map to CollabEvent
        const mapped: CollabEvent[] = data.map((e: any) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          starts_at: e.starts_at,
          ends_at: e.ends_at,
          is_online: e.is_online,
          meeting_url: e.meeting_url,
          attendee_count: e.attendee_count ?? 0,
          created_at: e.created_at,
          community_id: e.community_id,
          host_name: e.communities?.name ?? 'Group',
          trust_balance: 0,
          price: 0,
        }))
        setEvents(mapped)
      }
    } catch {
      setEvents(MOCK_EVENTS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchEvents() }, [fetchEvents])

  const filtered = events.filter(e => {
    if (minTrust > 0 && (e.trust_balance ?? 0) < minTrust) return false
    if (freeOnly && (e.price ?? 0) > 0) return false
    if (onlineOnly && !e.is_online) return false
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.description.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#f1f5f9' }}>
      <style>{`
        .event-card{background:#1e293b;border:1px solid #334155;border-radius:14px;overflow:hidden;transition:transform 0.2s,box-shadow 0.2s;}
        .event-card:hover{transform:translateY(-3px);box-shadow:0 16px 40px rgba(0,0,0,0.35);}
        .rsvp-btn{background:linear-gradient(135deg,#34d399,#059669);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;transition:opacity 0.15s;text-decoration:none;display:inline-block;}
        .rsvp-btn:hover{opacity:0.85;}
        input[type=range]{width:100%;accent-color:#34d399;}
        .filter-toggle{display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 0;}
      `}</style>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 32 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Link href="/collab" style={{ color: '#64748b', fontSize: 14, textDecoration: 'none' }}>Collab</Link>
              <span style={{ color: '#475569' }}>›</span>
              <span style={{ color: '#f1f5f9', fontSize: 14 }}>Events</span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>📅 Events</h1>
            <p style={{ color: '#64748b', margin: '6px 0 0', fontSize: 14 }}>Workshops, meetups, and online events from the community</p>
          </div>
          <Link href="/events/create" style={{
            background: 'linear-gradient(135deg,#34d399,#059669)', color: '#fff',
            textDecoration: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 600,
          }}>
            + Host an Event
          </Link>
        </div>

        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {/* Filters */}
          <div style={{ width: 240, flexShrink: 0, background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 20 }}>
            <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>Filters</h3>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Search</label>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Topic, speaker..."
                style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 10px', color: '#f1f5f9', fontSize: 13, boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: '#64748b', display: 'block', marginBottom: 6 }}>Min Host Trust: ₮{minTrust}</label>
              <input type="range" min={0} max={1000} step={50} value={minTrust} onChange={e => setMinTrust(parseInt(e.target.value))} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', marginTop: 2 }}><span>₮0</span><span>₮1000</span></div>
            </div>

            <label className="filter-toggle">
              <input type="checkbox" checked={freeOnly} onChange={e => setFreeOnly(e.target.checked)}
                style={{ accentColor: '#34d399' }} />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Free events only</span>
            </label>
            <label className="filter-toggle">
              <input type="checkbox" checked={onlineOnly} onChange={e => setOnlineOnly(e.target.checked)}
                style={{ accentColor: '#34d399' }} />
              <span style={{ fontSize: 13, color: '#94a3b8' }}>Online only</span>
            </label>

            <button onClick={() => { setMinTrust(0); setFreeOnly(false); setOnlineOnly(false); setSearch('') }}
              style={{ width: '100%', marginTop: 20, padding: '8px', background: 'transparent', border: '1px solid #334155', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: 13 }}>
              Reset
            </button>
          </div>

          {/* Events list */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1,2,3,4].map(i => <div key={i} style={{ background: '#1e293b', borderRadius: 14, height: 140, border: '1px solid #334155', opacity: 0.5 }} />)}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>{filtered.length} upcoming events</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {filtered.map(e => {
                    const badge = trustBadge(e.trust_balance ?? 0)
                    return (
                      <div key={e.id} className="event-card">
                        <div style={{ display: 'flex', gap: 0 }}>
                          {/* Date sidebar */}
                          <div style={{
                            width: 80, flexShrink: 0,
                            background: grad(e.id),
                            display: 'flex', flexDirection: 'column',
                            alignItems: 'center', justifyContent: 'center', padding: '16px 8px',
                          }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                              {new Date(e.starts_at).getDate()}
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', marginTop: 2 }}>
                              {new Date(e.starts_at).toLocaleDateString('en-GB', { month: 'short' })}
                            </div>
                          </div>
                          {/* Content */}
                          <div style={{ flex: 1, padding: '16px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9', marginBottom: 4 }}>{e.title}</div>
                                <div style={{ fontSize: 13, color: '#64748b', marginBottom: 10, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{e.description}</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#94a3b8' }}>
                                  <span>🕐 {formatDate(e.starts_at)}</span>
                                  <span>{e.is_online ? '💻 Online' : `📍 ${e.location ?? 'In-person'}`}</span>
                                  <span>👥 {e.attendee_count} attending</span>
                                  {e.host_name && <span>Hosted by <span style={{ color: badge.color }}>{e.host_name}</span></span>}
                                </div>
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                                <span style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
                                  {(e.price ?? 0) === 0 ? <span style={{ color: '#34d399' }}>Free</span> : `£${e.price}`}
                                </span>
                                <Link href={`/events/${e.id}`} className="rsvp-btn">RSVP</Link>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  {filtered.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                      <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
                      <div style={{ fontSize: 18, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>No events match your filters</div>
                      <div style={{ fontSize: 14 }}>Try adjusting your filters or be the first to host one!</div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CollabEventsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>Loading events...</div>}>
      <EventsContent />
    </Suspense>
  )
}
