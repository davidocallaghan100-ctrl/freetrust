'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, isToday, isThisWeek } from 'date-fns'

type EventMode = 'online' | 'in-person'
type Filter = 'all' | 'today' | 'this-week' | 'online' | 'in-person'

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
  { id: '1', title: 'Next.js 14 Deep Dive Workshop', date: new Date(), location: 'San Francisco, CA', mode: 'in-person', price: 49, rsvpCount: 128, description: 'Explore the latest features in Next.js 14 including server actions and partial prerendering.', category: 'Technology' },
  { id: '2', title: 'Open Source Contributor Meetup', date: new Date(Date.now() + 86400000), location: 'Online', mode: 'online', price: null, rsvpCount: 312, description: 'Connect with open source maintainers and learn how to make your first meaningful PR.', category: 'Technology' },
  { id: '3', title: 'TypeScript Advanced Patterns', date: new Date(Date.now() + 3 * 86400000), location: 'Online', mode: 'online', price: 19, rsvpCount: 74, description: 'Master conditional types, mapped types, and template literal types in TypeScript.', category: 'Technology' },
  { id: '4', title: 'Design Systems Summit 2025', date: new Date(Date.now() + 5 * 86400000), location: 'New York, NY', mode: 'in-person', price: 149, rsvpCount: 540, description: 'A full-day summit exploring design tokens, component libraries, and cross-team collaboration.', category: 'Design' },
  { id: '5', title: 'Zustand & React State Patterns', date: new Date(Date.now() + 8 * 86400000), location: 'Online', mode: 'online', price: null, rsvpCount: 197, description: 'Learn how to structure global state with Zustand for large-scale React applications.', category: 'Technology' },
  { id: '6', title: 'AI-Assisted Development Hackathon', date: new Date(Date.now() + 6 * 86400000), location: 'Austin, TX', mode: 'in-person', price: null, rsvpCount: 88, description: '48-hour hackathon focused on building developer tooling powered by large language models.', category: 'Technology' },
]

const FILTERS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'this-week' },
  { label: 'Online', value: 'online' },
  { label: 'In Person', value: 'in-person' },
]

function applyFilter(events: EventItem[], filter: Filter): EventItem[] {
  switch (filter) {
    case 'today': return events.filter(e => isToday(e.date))
    case 'this-week': return events.filter(e => isThisWeek(e.date, { weekStartsOn: 1 }))
    case 'online': return events.filter(e => e.mode === 'online')
    case 'in-person': return events.filter(e => e.mode === 'in-person')
    default: return events
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
          .from('events')
          .select('*')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(24)
        if (data && data.length > 0) {
          const mapped: EventItem[] = data.map((e: Record<string, unknown>) => ({
            id: e.id as string,
            title: e.title as string,
            date: new Date(e.starts_at as string),
            location: (e.location as string) ?? (e.is_online ? 'Online' : 'TBD'),
            mode: (e.is_online ? 'online' : 'in-person') as EventMode,
            price: e.price ? Number(e.price) : null,
            rsvpCount: (e.attendee_count as number) ?? 0,
            description: (e.description as string) ?? '',
            category: (e.category as string) ?? 'General',
          }))
          setEvents(mapped)
        }
      } catch {
        // keep mock data
      }
    })()
  }, [])

  const filtered = applyFilter(events, activeFilter)

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' }}>
      <style>{`
        .events-hero { background: linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%); padding: 2.5rem 1.5rem 2rem; border-bottom: 1px solid rgba(56,189,248,0.08); }
        .events-hero-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; }
        .events-content { max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem; }
        .events-filters { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 4px; }
        .events-grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(300px,1fr)); gap: 1.25rem; }
        .event-card { background: #1e293b; border: 1px solid rgba(56,189,248,0.1); border-radius: 14px; overflow: hidden; display: flex; flex-direction: column; text-decoration: none; transition: border-color 0.15s, transform 0.15s; }
        .event-card:hover { border-color: rgba(56,189,248,0.3); transform: translateY(-2px); }
        .event-banner { height: 100px; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; position: relative; }
        .event-body { padding: 1.25rem; flex: 1; display: flex; flex-direction: column; gap: 0.6rem; }
        .event-title { font-size: 1rem; font-weight: 700; color: #f1f5f9; line-height: 1.35; }
        .event-desc { font-size: 0.82rem; color: #64748b; line-height: 1.55; flex: 1; }
        .event-meta { display: flex; flex-direction: column; gap: 0.3rem; border-top: 1px solid rgba(56,189,248,0.06); padding-top: 0.75rem; font-size: 0.8rem; color: '#64748b'; }
        .event-badge { display: inline-flex; align-items: center; gap: 0.25rem; border-radius: 999px; padding: 0.15rem 0.55rem; font-size: 0.72rem; font-weight: 600; }

        @media (max-width: 768px) {
          .events-hero { padding: 1.5rem 1rem 1.25rem; }
          .events-content { padding: 1rem; }
          .events-grid { grid-template-columns: 1fr; }
          .events-hero-inner { flex-direction: column; align-items: flex-start; }
          .events-create-btn { width: 100%; text-align: center; justify-content: center; }
        }
      `}</style>

      {/* Header */}
      <div className="events-hero">
        <div className="events-hero-inner">
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.4rem' }}>Events</h1>
            <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Discover and join events from the FreeTrust community</p>
          </div>
          <Link
            href="/events/create"
            className="events-create-btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#38bdf8', color: '#0f172a', borderRadius: 8, padding: '0.65rem 1.25rem', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}
          >
            + Create Event
          </Link>
        </div>
      </div>

      <div className="events-content">
        {/* Filter Bar */}
        <div className="events-filters">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              style={{ flexShrink: 0, borderRadius: 999, padding: '0.4rem 1rem', fontSize: '0.82rem', fontWeight: activeFilter === f.value ? 700 : 500, background: activeFilter === f.value ? 'rgba(56,189,248,0.1)' : 'transparent', border: `1px solid ${activeFilter === f.value ? 'rgba(56,189,248,0.3)' : 'rgba(148,163,184,0.2)'}`, color: activeFilter === f.value ? '#38bdf8' : '#94a3b8', cursor: 'pointer' }}
            >
              {f.label}
            </button>
          ))}
        </div>

        <p style={{ marginBottom: '1.25rem', fontSize: '0.85rem', color: '#64748b' }}>
          Showing <strong style={{ color: '#f1f5f9' }}>{filtered.length}</strong> {filtered.length === 1 ? 'event' : 'events'}
        </p>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="events-grid">
            {filtered.map(event => {
              const bannerColors = ['rgba(167,139,250,0.15)', 'rgba(52,211,153,0.12)', 'rgba(56,189,248,0.12)', 'rgba(244,114,182,0.12)', 'rgba(251,146,60,0.12)']
              const bannerBg = bannerColors[parseInt(event.id) % bannerColors.length] ?? bannerColors[0]
              const emojis = ['🎤', '💻', '🌱', '🎨', '🚀', '🤝']
              const emoji = emojis[parseInt(event.id) % emojis.length] ?? '📅'
              return (
                <Link key={event.id} href={`/events/${event.id}`} className="event-card">
                  <div className="event-banner" style={{ background: bannerBg }}>
                    {emoji}
                    <div style={{ position: 'absolute', bottom: 8, left: 10, display: 'flex', gap: '0.35rem' }}>
                      <span className="event-badge" style={{ background: event.mode === 'online' ? 'rgba(52,211,153,0.15)' : 'rgba(167,139,250,0.15)', color: event.mode === 'online' ? '#34d399' : '#a78bfa', border: `1px solid ${event.mode === 'online' ? 'rgba(52,211,153,0.3)' : 'rgba(167,139,250,0.3)'}` }}>
                        {event.mode === 'online' ? '📡 Online' : '📍 In Person'}
                      </span>
                      <span className="event-badge" style={{ background: event.price === null ? 'rgba(52,211,153,0.12)' : 'rgba(56,189,248,0.1)', color: event.price === null ? '#34d399' : '#38bdf8', border: `1px solid ${event.price === null ? 'rgba(52,211,153,0.3)' : 'rgba(56,189,248,0.25)'}` }}>
                        {event.price === null ? 'Free' : `£${event.price}`}
                      </span>
                    </div>
                  </div>
                  <div className="event-body">
                    <div className="event-title">{event.title}</div>
                    <p className="event-desc">{event.description}</p>
                    <div className="event-meta">
                      <span style={{ color: '#94a3b8' }}>
                        📅 {isToday(event.date) ? `Today · ${format(event.date, 'h:mm a')}` : format(event.date, 'EEE, MMM d · h:mm a')}
                      </span>
                      <span style={{ color: '#94a3b8' }}>📍 {event.location}</span>
                      <span style={{ color: '#94a3b8' }}>👥 <strong style={{ color: '#f1f5f9' }}>{event.rsvpCount.toLocaleString()}</strong> going</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#1e293b', border: '1px dashed rgba(56,189,248,0.2)', borderRadius: 14, padding: '4rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
            <p style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.5rem' }}>No events found</p>
            <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1.5rem' }}>Try a different filter or create a new event.</p>
            <Link href="/events/create" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#38bdf8', color: '#0f172a', borderRadius: 8, padding: '0.6rem 1.25rem', fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none' }}>
              + Create Event
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
