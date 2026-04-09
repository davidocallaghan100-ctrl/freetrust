'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, isToday, isThisWeek } from 'date-fns'

type EventMode = 'online' | 'in-person'
type Filter = 'all' | 'today' | 'this-week' | 'online' | 'in-person' | 'free'

interface EventItem {
  id: string
  title: string
  date: Date
  location: string
  mode: EventMode
  price: number | null
  rsvpCount: number
  description: string
  category: string
}

const MOCK_EVENTS: EventItem[] = [
  { id: '1', title: 'FreeTrust Founders Meetup — Dublin', date: new Date(Date.now() + 1 * 86400000), location: 'Dogpatch Labs, Dublin 2', mode: 'in-person', price: null, rsvpCount: 87, description: 'Monthly in-person meetup for FreeTrust founders and early community members. Drinks, demos and networking.', category: 'Community' },
  { id: '2', title: 'How I Hit £10k/mo on FreeTrust — Live Q&A', date: new Date(Date.now() + 2 * 86400000), location: 'Online', mode: 'online', price: null, rsvpCount: 312, description: 'Tom Walsh shares his exact strategy for building a £10k/mo consulting business. Live Q&A at the end.', category: 'Business' },
  { id: '3', title: 'Sustainable Business Workshop', date: new Date(Date.now() + 3 * 86400000), location: 'Online', mode: 'online', price: 19, rsvpCount: 74, description: 'A practical 2-hour workshop on embedding sustainability into your business model. Certificate on completion.', category: 'Sustainability' },
  { id: '4', title: 'Design Systems Summit 2026', date: new Date(Date.now() + 5 * 86400000), location: 'RDS, Dublin 4', mode: 'in-person', price: 149, rsvpCount: 540, description: 'Full-day summit on design tokens, component libraries, and cross-team design collaboration.', category: 'Design' },
  { id: '5', title: 'Trust Score Masterclass: Earn Faster', date: new Date(Date.now() + 6 * 86400000), location: 'Online', mode: 'online', price: null, rsvpCount: 228, description: 'Learn exactly how the Trust scoring system works and the fastest legitimate paths to Elite level.', category: 'FreeTrust' },
  { id: '6', title: 'AI Automation Hackathon — 48hr', date: new Date(Date.now() + 7 * 86400000), location: 'Dogpatch Labs, Dublin 2', mode: 'in-person', price: null, rsvpCount: 88, description: '48-hour hackathon. Build AI-powered business automation tools. Prizes for top 3 teams.', category: 'Technology' },
  { id: '7', title: 'Impact Investment Pitch Night', date: new Date(Date.now() + 10 * 86400000), location: 'Online', mode: 'online', price: 25, rsvpCount: 140, description: '6 purpose-driven startups pitch to a panel of impact investors. Audience Q&A included.', category: 'Finance' },
  { id: '8', title: 'Community Photography Walk — Phoenix Park', date: new Date(), location: 'Phoenix Park, Dublin', mode: 'in-person', price: null, rsvpCount: 43, description: 'A relaxed morning walk through Phoenix Park (any skill level welcome). Coffee and chat after.', category: 'Community' },
  { id: '9', title: 'Next.js 15 Advanced Patterns', date: new Date(Date.now() + 4 * 86400000), location: 'Online', mode: 'online', price: 29, rsvpCount: 195, description: 'Deep dive into server components, partial prerendering, and advanced data patterns in Next.js 15.', category: 'Technology' },
  { id: '10', title: 'Women in Tech Networking Brunch', date: new Date(Date.now() + 12 * 86400000), location: 'The Alex Hotel, Dublin 2', mode: 'in-person', price: 35, rsvpCount: 61, description: 'Monthly brunch for women in tech and entrepreneurship. Informal, welcoming, and genuinely useful.', category: 'Community' },
  { id: '11', title: 'SEO in 2026: What Actually Works', date: new Date(Date.now() + 14 * 86400000), location: 'Online', mode: 'online', price: null, rsvpCount: 407, description: 'Marcus Obi breaks down the SEO strategies working right now and what to stop wasting time on.', category: 'Business' },
  { id: '12', title: 'Artisan Food Market — FreeTrust Sellers', date: new Date(Date.now() + 9 * 86400000), location: 'Smithfield Square, Dublin 7', mode: 'in-person', price: null, rsvpCount: 510, description: 'Monthly outdoor food market featuring FreeTrust sellers. Artisan bread, cheese, coffee, and more.', category: 'Food' },
]

const FILTERS: { label: string; value: Filter; icon: string }[] = [
  { label: 'All Events', value: 'all',       icon: '📅' },
  { label: 'Today',      value: 'today',     icon: '⚡' },
  { label: 'This Week',  value: 'this-week', icon: '📆' },
  { label: 'Online',     value: 'online',    icon: '💻' },
  { label: 'In Person',  value: 'in-person', icon: '📍' },
  { label: 'Free',       value: 'free',      icon: '🆓' },
]

const CAT_EMOJI: Record<string, string> = {
  Technology: '💻', Business: '💼', Community: '🤝', Design: '🎨',
  Sustainability: '🌱', Finance: '💰', FreeTrust: '⭐', Food: '🍽️', General: '📅',
}
const CAT_COLOR: Record<string, string> = {
  Technology: '#38bdf8', Business: '#fbbf24', Community: '#a78bfa', Design: '#f472b6',
  Sustainability: '#34d399', Finance: '#fb923c', FreeTrust: '#38bdf8', Food: '#fb923c', General: '#64748b',
}
const CAT_BANNER: Record<string, string> = {
  Technology:    'linear-gradient(135deg,rgba(56,189,248,0.15),rgba(56,189,248,0.04))',
  Business:      'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(251,191,36,0.04))',
  Community:     'linear-gradient(135deg,rgba(167,139,250,0.15),rgba(167,139,250,0.04))',
  Design:        'linear-gradient(135deg,rgba(244,114,182,0.15),rgba(244,114,182,0.04))',
  Sustainability:'linear-gradient(135deg,rgba(52,211,153,0.15),rgba(52,211,153,0.04))',
  Finance:       'linear-gradient(135deg,rgba(251,146,60,0.15),rgba(251,146,60,0.04))',
  FreeTrust:     'linear-gradient(135deg,rgba(56,189,248,0.15),rgba(129,140,248,0.04))',
  Food:          'linear-gradient(135deg,rgba(251,146,60,0.15),rgba(251,191,36,0.04))',
  General:       'linear-gradient(135deg,rgba(100,116,139,0.15),rgba(100,116,139,0.04))',
}

function applyFilter(events: EventItem[], filter: Filter): EventItem[] {
  switch (filter) {
    case 'today':     return events.filter(e => isToday(e.date))
    case 'this-week': return events.filter(e => isThisWeek(e.date, { weekStartsOn: 1 }))
    case 'online':    return events.filter(e => e.mode === 'online')
    case 'in-person': return events.filter(e => e.mode === 'in-person')
    case 'free':      return events.filter(e => e.price === null)
    default:          return events
  }
}

export default function EventsPage() {
  const [activeFilter, setActiveFilter] = useState<Filter>('all')
  const [events, setEvents] = useState<EventItem[]>(MOCK_EVENTS)

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data } = await supabase
          .from('events').select('*')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true }).limit(24)
        if (data && data.length > 0) {
          setEvents(data.map((e: Record<string, unknown>) => ({
            id: e.id as string, title: e.title as string,
            date: new Date(e.starts_at as string),
            location: (e.location as string) ?? (e.is_online ? 'Online' : 'TBD'),
            mode: (e.is_online ? 'online' : 'in-person') as EventMode,
            price: e.price ? Number(e.price) : null,
            rsvpCount: (e.attendee_count as number) ?? 0,
            description: (e.description as string) ?? '',
            category: (e.category as string) ?? 'General',
          })))
        }
      } catch { /* keep mock */ }
    })()
  }, [])

  const filtered = applyFilter(events, activeFilter)

  return (
    <div style={{ minHeight: 'calc(100vh - 104px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif', paddingTop: 104 }}>
      <style>{`
        .ev-hero { padding: 24px 20px 18px; background: linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%); border-bottom: 1px solid rgba(56,189,248,0.08); }
        .ev-hero-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .ev-content { max-width: 1200px; margin: 0 auto; padding: 20px 20px 100px; }
        .ev-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }

        .ev-filters { display: flex; gap: 8px; margin-bottom: 14px; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; padding-bottom: 2px; }
        .ev-filters::-webkit-scrollbar { display: none; }
        .ev-pill { flex-shrink: 0; display: flex; align-items: center; gap: 5px; border-radius: 999px; padding: 7px 14px; font-size: 13px; font-weight: 500; cursor: pointer; border: 1px solid rgba(148,163,184,0.2); background: transparent; color: #94a3b8; font-family: inherit; white-space: nowrap; transition: all 0.12s; min-height: 38px; }
        .ev-pill.active { background: rgba(56,189,248,0.1); border-color: rgba(56,189,248,0.35); color: #38bdf8; font-weight: 700; }
        .ev-pill:hover:not(.active) { background: rgba(255,255,255,0.04); color: #f1f5f9; }

        .ev-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.08); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; text-decoration: none; transition: border-color 0.15s, transform 0.15s; }
        .ev-card:hover { border-color: rgba(56,189,248,0.28); transform: translateY(-2px); }
        .ev-card:active { transform: scale(0.99); }
        .ev-banner { height: 90px; display: flex; align-items: center; justify-content: center; font-size: 2.4rem; position: relative; }
        .ev-body { padding: 14px; flex: 1; display: flex; flex-direction: column; gap: 6px; }
        .ev-title { font-size: 15px; font-weight: 700; color: #f1f5f9; line-height: 1.35; }
        .ev-desc { font-size: 12px; color: #64748b; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; margin: 0; }
        .ev-footer { padding: 10px 14px 14px; display: flex; flex-direction: column; gap: 5px; border-top: 1px solid rgba(56,189,248,0.06); }
        .ev-meta { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #94a3b8; min-width: 0; }
        .ev-meta span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ev-badge { display: inline-flex; align-items: center; gap: 3px; border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 700; white-space: nowrap; }
        .ev-badges { position: absolute; bottom: 8px; left: 10px; display: flex; gap: 5px; flex-wrap: wrap; }
        .ev-cat-chip { position: absolute; top: 8px; right: 10px; border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 700; }
        .ev-create-btn { display: inline-flex; align-items: center; gap: 6px; background: #38bdf8; color: #0f172a; border-radius: 10px; padding: 10px 18px; font-weight: 700; font-size: 14px; text-decoration: none; white-space: nowrap; min-height: 44px; }
        .ev-rsvp { background: #38bdf8; color: #0f172a; border-radius: 7px; padding: 5px 14px; font-size: 12px; font-weight: 700; flex-shrink: 0; }

        @media (max-width: 640px) {
          .ev-hero { padding: 16px 14px 14px; }
          .ev-content { padding: 14px 12px 100px; }
          .ev-grid { grid-template-columns: 1fr; gap: 12px; }
          .ev-create-btn { width: 100%; justify-content: center; }
          .ev-banner { height: 80px; font-size: 2rem; }
          .ev-body { padding: 12px; }
          .ev-footer { padding: 8px 12px 12px; }
          .ev-hero-inner h1 { font-size: 22px !important; }
        }
      `}</style>

      {/* ── Hero ── */}
      <div className="ev-hero">
        <div className="ev-hero-inner">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 26, fontWeight: 800, margin: '0 0 4px' }}>Events</h1>
            <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Discover and join community events online and in person</p>
          </div>
          <Link href="/events/create" className="ev-create-btn">+ Create Event</Link>
        </div>
      </div>

      <div className="ev-content">
        {/* ── Filter Pills ── */}
        <div className="ev-filters">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={`ev-pill${activeFilter === f.value ? ' active' : ''}`}
            >
              <span>{f.icon}</span>
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Count + clear ── */}
        <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
          <strong style={{ color: '#f1f5f9' }}>{filtered.length}</strong>&nbsp;
          {filtered.length === 1 ? 'event' : 'events'}
          {activeFilter !== 'all' && (
            <button
              onClick={() => setActiveFilter('all')}
              style={{ marginLeft: 10, background: 'none', border: '1px solid #334155', borderRadius: 6, padding: '2px 8px', fontSize: 11, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* ── Grid ── */}
        {filtered.length > 0 ? (
          <div className="ev-grid">
            {filtered.map(event => {
              const cat = event.category
              const catColor  = CAT_COLOR[cat]  ?? '#64748b'
              const bannerBg  = CAT_BANNER[cat] ?? CAT_BANNER.General
              const emoji     = CAT_EMOJI[cat]  ?? '📅'
              const dateLabel = isToday(event.date)
                ? `Today · ${format(event.date, 'h:mm a')}`
                : format(event.date, 'EEE d MMM · h:mm a')

              return (
                <Link key={event.id} href={`/events/${event.id}`} className="ev-card">
                  <div className="ev-banner" style={{ background: bannerBg }}>
                    <span>{emoji}</span>
                    {/* Category chip */}
                    <span className="ev-cat-chip" style={{ background: `${catColor}18`, color: catColor, border: `1px solid ${catColor}30` }}>
                      {cat}
                    </span>
                    {/* Mode + price badges */}
                    <div className="ev-badges">
                      <span className="ev-badge" style={{ background: event.mode === 'online' ? 'rgba(52,211,153,0.18)' : 'rgba(167,139,250,0.18)', color: event.mode === 'online' ? '#34d399' : '#a78bfa', border: `1px solid ${event.mode === 'online' ? 'rgba(52,211,153,0.35)' : 'rgba(167,139,250,0.35)'}` }}>
                        {event.mode === 'online' ? '💻 Online' : '📍 In Person'}
                      </span>
                      <span className="ev-badge" style={{ background: event.price === null ? 'rgba(52,211,153,0.12)' : 'rgba(56,189,248,0.12)', color: event.price === null ? '#34d399' : '#38bdf8', border: `1px solid ${event.price === null ? 'rgba(52,211,153,0.3)' : 'rgba(56,189,248,0.25)'}` }}>
                        {event.price === null ? '🆓 Free' : `£${event.price}`}
                      </span>
                    </div>
                  </div>

                  <div className="ev-body">
                    <div className="ev-title">{event.title}</div>
                    <p className="ev-desc">{event.description}</p>
                  </div>

                  <div className="ev-footer">
                    <div className="ev-meta"><span>📅</span><span>{dateLabel}</span></div>
                    <div className="ev-meta">
                      <span>{event.mode === 'online' ? '🌐' : '📍'}</span>
                      <span>{event.location}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                      <div className="ev-meta" style={{ margin: 0 }}>
                        <span>👥</span>
                        <span><strong style={{ color: '#f1f5f9' }}>{event.rsvpCount.toLocaleString()}</strong> going</span>
                      </div>
                      <span className="ev-rsvp">RSVP →</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#1e293b', border: '1px dashed rgba(56,189,248,0.2)', borderRadius: 14, padding: '60px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
            <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No events found</p>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>Try a different filter or create a new event.</p>
            <Link href="/events/create" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#38bdf8', color: '#0f172a', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              + Create Event
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
