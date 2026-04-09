'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type EventMode = 'online' | 'in-person'
type TimeFilter = 'all' | 'this-week' | 'this-month'
type ModeFilter = 'all' | 'online' | 'in-person'
type PriceFilter = 'all' | 'free' | 'paid'

interface EventItem {
  id: string
  title: string
  date: Date
  time?: string
  location: string
  mode: EventMode
  price: number | null
  rsvpCount: number
  description: string
  category: string
  organiser?: string
  organiserTrust?: number
  organiserAvatar?: string
  imageGradient?: string
}

const CAT_COLORS: Record<string, string> = {
  Community: '#38bdf8', Business: '#a78bfa', Technology: '#34d399',
  Design: '#f472b6', Finance: '#fbbf24', Sustainability: '#34d399',
  FreeTrust: '#38bdf8', Health: '#fb923c', Education: '#a78bfa',
}

const CAT_GRADIENTS: Record<string, string> = {
  Community:    'linear-gradient(135deg,#0ea5e9,#0369a1)',
  Business:     'linear-gradient(135deg,#7c3aed,#4c1d95)',
  Technology:   'linear-gradient(135deg,#059669,#047857)',
  Design:       'linear-gradient(135deg,#db2777,#9d174d)',
  Finance:      'linear-gradient(135deg,#d97706,#92400e)',
  Sustainability:'linear-gradient(135deg,#059669,#065f46)',
  FreeTrust:    'linear-gradient(135deg,#0284c7,#1e40af)',
  Health:       'linear-gradient(135deg,#ea580c,#c2410c)',
  Education:    'linear-gradient(135deg,#7c3aed,#4338ca)',
}

const CATEGORIES = ['All', 'Community', 'Business', 'Technology', 'Design', 'Finance', 'Sustainability', 'Education', 'Health']

const MOCK_EVENTS: EventItem[] = [
  { id:'e1', title:'FreeTrust Founders Meetup — Dublin', date:new Date(Date.now()+1*86400000), time:'6:30 PM', location:'Dogpatch Labs, Dublin 2', mode:'in-person', price:null, rsvpCount:87, description:'Monthly in-person meetup for FreeTrust founders and early members. Drinks, demos and networking.', category:'Community', organiser:'Sarah Chen', organiserTrust:1240, organiserAvatar:'https://i.pravatar.cc/40?img=47', imageGradient:'linear-gradient(135deg,#0284c7,#1e40af)' },
  { id:'e2', title:'How I Hit £10k/mo on FreeTrust — Live Q&A', date:new Date(Date.now()+2*86400000), time:'7:00 PM', location:'Online', mode:'online', price:null, rsvpCount:312, description:'Tom Walsh shares his exact strategy for building a £10k/mo consulting business using FreeTrust. Live Q&A included.', category:'Business', organiser:'Tom Walsh', organiserTrust:890, organiserAvatar:'https://i.pravatar.cc/40?img=53', imageGradient:'linear-gradient(135deg,#7c3aed,#4c1d95)' },
  { id:'e3', title:'Sustainable Business Workshop', date:new Date(Date.now()+3*86400000), time:'2:00 PM', location:'Online', mode:'online', price:19, rsvpCount:74, description:'A practical 2-hour workshop on embedding sustainability into your business model. Certificate on completion.', category:'Sustainability', organiser:'Amara Diallo', organiserTrust:650, organiserAvatar:'https://i.pravatar.cc/40?img=45', imageGradient:'linear-gradient(135deg,#059669,#065f46)' },
  { id:'e4', title:'Design Systems Summit 2026', date:new Date(Date.now()+5*86400000), time:'9:00 AM', location:'RDS, Dublin 4', mode:'in-person', price:149, rsvpCount:540, description:'Full-day summit on design tokens, component libraries, and cross-team design collaboration. Speakers from Shopify, Stripe and Figma.', category:'Design', organiser:'Priya Nair', organiserTrust:1580, organiserAvatar:'https://i.pravatar.cc/40?img=44', imageGradient:'linear-gradient(135deg,#db2777,#9d174d)' },
  { id:'e5', title:'Trust Score Masterclass: Earn Faster', date:new Date(Date.now()+6*86400000), time:'6:00 PM', location:'Online', mode:'online', price:null, rsvpCount:228, description:'Learn exactly how the Trust scoring system works and the fastest legitimate paths to Elite level.', category:'FreeTrust', organiser:'Marcus Obi', organiserTrust:2100, organiserAvatar:'https://i.pravatar.cc/40?img=12', imageGradient:'linear-gradient(135deg,#0284c7,#1e40af)' },
  { id:'e6', title:'AI Automation Hackathon — 48hr', date:new Date(Date.now()+7*86400000), time:'10:00 AM', location:'Dogpatch Labs, Dublin 2', mode:'in-person', price:null, rsvpCount:88, description:'48-hour hackathon. Build AI-powered business automation tools. €5,000 in prizes for top 3 teams.', category:'Technology', organiser:'Lena Fischer', organiserTrust:780, organiserAvatar:'https://i.pravatar.cc/40?img=41', imageGradient:'linear-gradient(135deg,#059669,#047857)' },
  { id:'e7', title:'Impact Investment Pitch Night', date:new Date(Date.now()+10*86400000), time:'7:30 PM', location:'Online', mode:'online', price:25, rsvpCount:140, description:'Six purpose-driven startups pitch to a panel of impact investors. Audience Q&A and networking after.', category:'Finance', organiser:'James Okafor', organiserTrust:920, organiserAvatar:'https://i.pravatar.cc/40?img=13', imageGradient:'linear-gradient(135deg,#d97706,#92400e)' },
  { id:'e8', title:'Community Photography Walk — Phoenix Park', date:new Date(Date.now()+12*86400000), time:'10:00 AM', location:'Phoenix Park, Dublin', mode:'in-person', price:null, rsvpCount:43, description:'A relaxed morning walk through Phoenix Park. Any skill level welcome. Coffee and chat after.', category:'Community', organiser:'Ciara Murphy', organiserTrust:340, organiserAvatar:'https://i.pravatar.cc/40?img=39', imageGradient:'linear-gradient(135deg,#0ea5e9,#0369a1)' },
  { id:'e9', title:'Freelance Finance: Tax, VAT & Invoicing', date:new Date(Date.now()+14*86400000), time:'11:00 AM', location:'Online', mode:'online', price:29, rsvpCount:196, description:'Everything freelancers need to know about money: VAT registration, expenses, invoicing best practices and more.', category:'Finance', organiser:'Dave Kelly', organiserTrust:1100, organiserAvatar:'https://i.pravatar.cc/40?img=15', imageGradient:'linear-gradient(135deg,#d97706,#92400e)' },
]

function formatEventDate(date: Date) {
  return {
    day: date.toLocaleDateString('en-GB', { weekday: 'short' }),
    num: date.getDate(),
    month: date.toLocaleDateString('en-GB', { month: 'short' }),
    year: date.getFullYear(),
    full: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
  }
}

function isThisWeek(date: Date) {
  const now = new Date()
  const end = new Date(now); end.setDate(now.getDate() + 7)
  return date >= now && date <= end
}

function isThisMonth(date: Date) {
  const now = new Date()
  const end = new Date(now); end.setDate(now.getDate() + 30)
  return date >= now && date <= end
}

function EventCard({ ev, onRsvp }: { ev: EventItem; onRsvp: (id: string) => void }) {
  const { day, num, month, year } = formatEventDate(ev.date)
  const catColor = CAT_COLORS[ev.category] ?? '#38bdf8'
  const gradient = CAT_GRADIENTS[ev.category] ?? ev.imageGradient ?? 'linear-gradient(135deg,#0284c7,#1e40af)'

  return (
    <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.15s, box-shadow 0.15s', cursor: 'pointer' }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 8px 32px rgba(56,189,248,0.15)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform=''; (e.currentTarget as HTMLElement).style.boxShadow='' }}>

      {/* Cover / gradient header */}
      <div style={{ height: 120, background: gradient, position: 'relative', flexShrink: 0 }}>
        {/* Date stamp */}
        <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '6px 10px', textAlign: 'center', minWidth: 48 }}>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{day}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#f1f5f9', lineHeight: 1 }}>{num}</div>
          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8' }}>{month} {year}</div>
        </div>

        {/* Badges top right */}
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
          {ev.mode === 'online'
            ? <span style={{ background: 'rgba(56,189,248,0.9)', color: '#0f172a', fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>ONLINE</span>
            : <span style={{ background: 'rgba(148,163,184,0.9)', color: '#0f172a', fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>IN-PERSON</span>
          }
          {ev.price === null || ev.price === 0
            ? <span style={{ background: 'rgba(52,211,153,0.9)', color: '#0f172a', fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>FREE</span>
            : <span style={{ background: 'rgba(245,158,11,0.9)', color: '#0f172a', fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>£{ev.price}</span>
          }
        </div>

        {/* Category pill bottom */}
        <div style={{ position: 'absolute', bottom: 10, left: 12 }}>
          <span style={{ background: `${catColor}22`, border: `1px solid ${catColor}50`, color: catColor, fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>{ev.category}</span>
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1.3 }}>{ev.title}</div>

        {/* Date + time row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#38bdf8', fontWeight: 600 }}>
          <span>🗓</span>
          <span>{formatEventDate(ev.date).full}{ev.time ? ` · ${ev.time}` : ''}</span>
        </div>

        {/* Location */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', color: '#64748b' }}>
          <span>📍</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.location}</span>
        </div>

        {/* Description */}
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.55, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{ev.description}</p>

        {/* Organiser */}
        {ev.organiser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '0.25rem', borderTop: '1px solid rgba(56,189,248,0.07)' }}>
            {ev.organiserAvatar
              ? <img src={ev.organiserAvatar} alt={ev.organiser} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              : <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#334155', flexShrink: 0 }} />
            }
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{ev.organiser}</span>
            {ev.organiserTrust && <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#38bdf8', fontWeight: 700, background: 'rgba(56,189,248,0.08)', padding: '1px 6px', borderRadius: 6 }}>₮{ev.organiserTrust.toLocaleString()}</span>}
          </div>
        )}

        {/* Footer: attendees + buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', color: '#64748b' }}>
            <span>👥</span>
            <span>{ev.rsvpCount.toLocaleString()} attending</span>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={() => onRsvp(ev.id)}
              style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 8, padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 36 }}>
              {ev.price ? `Buy · £${ev.price}` : 'RSVP Free'}
            </button>
            <button
              style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.45rem 0.6rem', fontSize: '0.78rem', color: '#38bdf8', cursor: 'pointer', minHeight: 36 }}
              title="Share event">
              ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function EventsPage() {
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all')
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all')
  const [catFilter, setCatFilter] = useState('All')
  const [rsvped, setRsvped] = useState<Set<string>>(new Set())
  const [dbEvents, setDbEvents] = useState<EventItem[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      try {
        const { data } = await supabase
          .from('community_events')
          .select('id, title, description, starts_at, ends_at, is_online, meeting_url, attendee_count')
          .gte('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(50)
        if (data && data.length > 0) {
          setDbEvents(data.map((e: Record<string, unknown>) => ({
            id: String(e.id),
            title: String(e.title ?? ''),
            date: new Date(String(e.starts_at ?? Date.now())),
            time: e.starts_at ? new Date(String(e.starts_at)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : undefined,
            location: e.is_online ? 'Online' : 'In Person',
            mode: e.is_online ? 'online' : 'in-person',
            price: null,
            rsvpCount: Number(e.attendee_count ?? 0),
            description: String(e.description ?? ''),
            category: 'Community',
          })))
        }
      } catch { /* use mock */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const events = dbEvents ?? MOCK_EVENTS

  const filtered = events.filter(ev => {
    if (modeFilter !== 'all' && ev.mode !== modeFilter) return false
    if (priceFilter === 'free' && ev.price !== null && ev.price > 0) return false
    if (priceFilter === 'paid' && (ev.price === null || ev.price === 0)) return false
    if (timeFilter === 'this-week' && !isThisWeek(ev.date)) return false
    if (timeFilter === 'this-month' && !isThisMonth(ev.date)) return false
    if (catFilter !== 'All' && ev.category !== catFilter) return false
    return true
  })

  function handleRsvp(id: string) {
    setRsvped(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  }

  const pillStyle = (active: boolean, color = '#38bdf8') => ({
    padding: '0.4rem 0.9rem', borderRadius: 999, fontSize: '0.8rem', fontWeight: active ? 700 : 500,
    cursor: 'pointer', border: `1px solid ${active ? color : 'rgba(148,163,184,0.2)'}`,
    background: active ? `${color}18` : 'transparent', color: active ? color : '#94a3b8',
    whiteSpace: 'nowrap' as const, minHeight: 36,
  })

  return (
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 104, paddingBottom: 80 }}>
      <style>{`
        .ev-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 1.25rem; }
        .ev-filter-bar { display: flex; gap: 0.5rem; flex-wrap: wrap; }
        .ev-filter-row { display: flex; gap: 0.5rem; overflow-x: auto; scrollbar-width: none; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
        .ev-filter-row::-webkit-scrollbar { display: none; }
        .ev-create-btn { background: linear-gradient(135deg,#38bdf8,#0284c7); color: #fff; padding: 0.6rem 1.25rem; border-radius: 10px; font-weight: 700; font-size: 0.88rem; text-decoration: none; flex-shrink: 0; min-height: 44px; display: flex; align-items: center; white-space: nowrap; }
        @media (max-width: 1024px) { .ev-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 640px) {
          .ev-grid { grid-template-columns: 1fr !important; }
          .ev-header-row { flex-direction: column !important; align-items: flex-start !important; }
          .ev-create-btn { width: 100%; justify-content: center; }
        }
      `}</style>

      {/* Header */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem 1.5rem' }}>
        <div className="ev-header-row" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.2rem)', fontWeight: 900, margin: '0 0 0.25rem', letterSpacing: '-0.5px' }}>Events</h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>{filtered.length} upcoming event{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/events/create" className="ev-create-btn">
            + Create Event
          </Link>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {/* Mode + Price + Time */}
          <div className="ev-filter-row">
            {(['all','online','in-person'] as ModeFilter[]).map(f => (
              <button key={f} onClick={() => setModeFilter(f)} style={pillStyle(modeFilter === f)}>
                {f === 'all' ? 'All Formats' : f === 'online' ? '💻 Online' : '📍 In-Person'}
              </button>
            ))}
            <div style={{ width: 1, background: 'rgba(148,163,184,0.2)', margin: '0 4px', flexShrink: 0 }} />
            {(['all','free','paid'] as PriceFilter[]).map(f => (
              <button key={f} onClick={() => setPriceFilter(f)} style={pillStyle(priceFilter === f, f === 'free' ? '#34d399' : f === 'paid' ? '#f59e0b' : '#38bdf8')}>
                {f === 'all' ? 'Any Price' : f === 'free' ? '🟢 Free' : '💳 Paid'}
              </button>
            ))}
            <div style={{ width: 1, background: 'rgba(148,163,184,0.2)', margin: '0 4px', flexShrink: 0 }} />
            {(['all','this-week','this-month'] as TimeFilter[]).map(f => (
              <button key={f} onClick={() => setTimeFilter(f)} style={pillStyle(timeFilter === f)}>
                {f === 'all' ? 'All Upcoming' : f === 'this-week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>

          {/* Category pills */}
          <div className="ev-filter-row">
            {CATEGORIES.map(c => (
              <button key={c} onClick={() => setCatFilter(c)} style={pillStyle(catFilter === c, CAT_COLORS[c] ?? '#38bdf8')}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Grid or empty state */}
        {loading ? (
          <div className="ev-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} style={{ background: '#1e293b', borderRadius: 16, height: 340, opacity: 0.5 }}>
                <div style={{ height: 120, background: '#334155', borderRadius: '16px 16px 0 0' }} />
                <div style={{ padding: '1rem' }}>
                  <div style={{ height: 14, background: '#334155', borderRadius: 6, marginBottom: 8, width: '80%' }} />
                  <div style={{ height: 12, background: '#334155', borderRadius: 6, width: '60%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📅</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', color: '#f1f5f9' }}>No events found</h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              {catFilter !== 'All' || modeFilter !== 'all' || priceFilter !== 'all' || timeFilter !== 'all'
                ? 'Try adjusting your filters — or be the first to create an event in this category.'
                : 'No upcoming events yet — why not create one?'}
            </p>
            <Link href="/events/create" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.75rem 1.75rem', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem' }}>
              Create an Event →
            </Link>
          </div>
        ) : (
          <div className="ev-grid">
            {filtered.map(ev => (
              <EventCard key={ev.id} ev={ev} onRsvp={handleRsvp} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
