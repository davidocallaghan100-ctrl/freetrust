'use client'
import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import LocationFilter from '@/components/location/LocationFilter'
import LocationBadge from '@/components/location/LocationBadge'
import EventsMap, { type MapEvent } from '@/components/events/EventsMap'
import PriceDisplay from '@/components/currency/PriceDisplay'
import { useCurrency, type CurrencyCode } from '@/context/CurrencyContext'
import { EMPTY_LOCATION, haversineKm, type StructuredLocation, type RadiusValue } from '@/lib/geo'
import { buildCountryOptions } from '@/lib/countries'

type EventMode = 'online' | 'in-person'
type TimeFilter = 'all' | 'this-week' | 'this-month'
type ModeFilter = 'all' | 'online' | 'in-person'
type PriceFilter = 'all' | 'free' | 'paid'
type ViewMode = 'list' | 'map'

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
  // Globalisation fields
  country?: string | null
  city?: string | null
  latitude?: number | null
  longitude?: number | null
  location_label?: string | null
  distance_km?: number | null
  price_eur?: number | null
  currency_code?: string | null
}

const CAT_COLORS: Record<string, string> = {
  Community:    '#38bdf8', Business:    '#a78bfa', Technology:  '#34d399',
  Design:       '#f472b6', Finance:     '#fbbf24', Sustainability: '#4ade80',
  FreeTrust:    '#38bdf8', Health:      '#fb923c', Education:   '#a78bfa',
  AI:           '#e879f9', Startup:     '#38bdf8', Marketing:   '#fb923c',
  Web3:         '#818cf8', 'E-commerce':'#f59e0b',
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
  AI:           'linear-gradient(135deg,#a855f7,#6d28d9)',
  Startup:      'linear-gradient(135deg,#0284c7,#1e40af)',
  Marketing:    'linear-gradient(135deg,#ea580c,#c2410c)',
  Web3:         'linear-gradient(135deg,#4f46e5,#3730a3)',
  'E-commerce': 'linear-gradient(135deg,#d97706,#b45309)',
}

const CATEGORIES = ['All', 'Startup', 'Technology', 'AI', 'Business', 'Design', 'Marketing', 'Web3', 'E-commerce', 'Sustainability', 'Community', 'Finance', 'Education', 'Health']



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
  const { format: currencyFormat } = useCurrency()

  return (
    <Link href={`/events/${ev.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
    <div style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 16, overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.15s, box-shadow 0.15s', cursor: 'pointer', height: '100%' }}
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
            : (
              <span style={{ background: 'rgba(245,158,11,0.92)', color: '#0f172a', fontSize: '0.65rem', fontWeight: 800, padding: '2px 8px', borderRadius: 999 }}>
                {currencyFormat(ev.price_eur ?? ev.price, (ev.currency_code ?? 'EUR') as CurrencyCode)}
              </span>
            )
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
        <div>
          <LocationBadge
            label={ev.location_label ?? ev.location ?? null}
            remote={ev.mode === 'online'}
            distanceKm={ev.distance_km ?? null}
            compact
          />
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
          {/* Dual-currency price line — only shown for paid events. The
              Buy button uses the user's selected currency rather than the
              hardcoded GBP from the previous version. */}
          {ev.price != null && ev.price > 0 && (
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <PriceDisplay
                amountEur={ev.price_eur ?? ev.price}
                sourceCode={(ev.currency_code ?? 'EUR') as CurrencyCode}
                sourceAmount={ev.price}
                size="sm"
                layout="stacked"
              />
            </div>
          )}
          <div style={{ marginLeft: ev.price && ev.price > 0 ? 0 : 'auto', display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); onRsvp(ev.id) }}
              style={{ background: 'linear-gradient(135deg,#38bdf8,#0284c7)', border: 'none', borderRadius: 8, padding: '0.45rem 1rem', fontSize: '0.78rem', fontWeight: 700, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 36 }}>
              {ev.price ? `Buy · ${currencyFormat(ev.price_eur ?? ev.price, (ev.currency_code ?? 'EUR') as CurrencyCode)}` : 'RSVP Free'}
            </button>
            <button
              onClick={e => { e.preventDefault(); e.stopPropagation(); if (navigator.share) { navigator.share({ title: ev.title, url: `${window.location.origin}/events/${ev.id}` }) } else { navigator.clipboard.writeText(`${window.location.origin}/events/${ev.id}`) } }}
              style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 8, padding: '0.45rem 0.6rem', fontSize: '0.78rem', color: '#38bdf8', cursor: 'pointer', minHeight: 36 }}
              title="Share event">
              ↗
            </button>
          </div>
        </div>
      </div>
    </div>
    </Link>
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
  // Globalisation — location filter + view toggle
  const [filterLoc, setFilterLoc] = useState<StructuredLocation>(EMPTY_LOCATION)
  const [radiusKm, setRadiusKm] = useState<RadiusValue>(0)
  const [countryFilter, setCountryFilter] = useState<string | null>(null)
  const [view, setView] = useState<ViewMode>('list')
  // Surface load failures instead of silently falling back to mock data.
  // Previously a schema mismatch (e.g. a missing globalisation column in
  // production) would throw inside the select, hit `catch { /* use mock */ }`,
  // and leave the user staring at "No upcoming events" with zero clue
  // that anything had gone wrong.
  const [loadError, setLoadError] = useState<string | null>(null)



  useEffect(() => {
    const supabase = createClient()
    async function load() {
      try {
        // Read from the `events` table (the one the publish route writes
        // to + the /api/events route reads from + the new globalisation
        // migration added geo columns to). Previously this page read from
        // community_events which has none of the new fields.
        //
        // Date filter — allow NULL starts_at (events without a fixed start
        // date) AND events that started up to 24 hours ago (recurring /
        // ongoing / just-started events shouldn't disappear the moment
        // their start time passes). Previously `.gte('starts_at', now)`
        // hid both cases, contributing to the "no events showing" report.
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data, error } = await supabase
          .from('events')
          .select('id, title, description, starts_at, ends_at, is_online, meeting_url, attendee_count, is_paid, ticket_price, ticket_price_eur, currency_code, country, region, city, latitude, longitude, location_label, venue_name, category')
          .eq('status', 'published')
          .or(`starts_at.is.null,starts_at.gte.${oneDayAgo}`)
          .order('starts_at', { ascending: true, nullsFirst: false })
          .limit(200)
        if (error) {
          // Surface the real Supabase error so schema mismatches, RLS
          // denials, and missing columns are debuggable in the browser
          // console AND in the visible error banner.
          console.error('[events] supabase query failed:', error)
          setLoadError(error.message || 'Failed to load events')
          setDbEvents([])
          return
        }
        if (data) {
          setDbEvents(data.map((e: Record<string, unknown>) => ({
            id: String(e.id),
            title: String(e.title ?? ''),
            date: new Date(String(e.starts_at ?? Date.now())),
            time: e.starts_at ? new Date(String(e.starts_at)).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : undefined,
            location: (e.location_label as string | null | undefined) ?? (e.venue_name as string | null | undefined) ?? (e.is_online ? 'Online' : 'In Person'),
            mode: e.is_online ? 'online' : 'in-person',
            price: typeof e.ticket_price === 'number' ? (e.ticket_price as number) : null,
            rsvpCount: Number(e.attendee_count ?? 0),
            description: String(e.description ?? ''),
            category: (e.category as string | null | undefined) ?? 'Community',
            // Globalisation fields
            country:        (e.country as string | null | undefined) ?? null,
            city:           (e.city as string | null | undefined) ?? null,
            latitude:       typeof e.latitude  === 'number' ? (e.latitude as number)  : null,
            longitude:      typeof e.longitude === 'number' ? (e.longitude as number) : null,
            location_label: (e.location_label as string | null | undefined) ?? null,
            price_eur:      typeof e.ticket_price_eur === 'number' ? (e.ticket_price_eur as number) : null,
            currency_code:  (e.currency_code as string | null | undefined) ?? null,
          })))
        } else {
          setDbEvents([])
        }
      } catch (err) {
        // Network / runtime error — surface it instead of silently
        // falling back to "No events found" with no explanation.
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[events] load threw:', msg, err)
        setLoadError(msg)
        setDbEvents([])
      }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const events = dbEvents ?? []

  // Country options merged with the global ISO 3166-1 reference list so
  // users can browse events worldwide, not just countries already in the
  // current data. See lib/countries.ts buildCountryOptions.
  const countryOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of events) {
      if (!e.country) continue
      counts.set(e.country, (counts.get(e.country) ?? 0) + 1)
    }
    return buildCountryOptions(counts)
  }, [events])

  // Compute distance_km, then filter
  const filtered = events.map(ev => {
    if (
      filterLoc.latitude != null && filterLoc.longitude != null &&
      ev.latitude != null && ev.longitude != null
    ) {
      return {
        ...ev,
        distance_km: haversineKm(
          { latitude: filterLoc.latitude, longitude: filterLoc.longitude },
          { latitude: ev.latitude, longitude: ev.longitude }
        ),
      }
    }
    return ev
  }).filter(ev => {
    if (modeFilter !== 'all' && ev.mode !== modeFilter) return false
    if (priceFilter === 'free' && ev.price !== null && ev.price > 0) return false
    if (priceFilter === 'paid' && (ev.price === null || ev.price === 0)) return false
    if (timeFilter === 'this-week' && !isThisWeek(ev.date)) return false
    if (timeFilter === 'this-month' && !isThisMonth(ev.date)) return false
    if (catFilter !== 'All' && ev.category !== catFilter) return false
    if (countryFilter && ev.country !== countryFilter) return false
    if (radiusKm > 0 && filterLoc.latitude != null) {
      // Online events always show through — distance is meaningless
      if (ev.mode !== 'online' && (ev.distance_km == null || ev.distance_km > radiusKm)) return false
    }
    return true
  })

  // Sort: local first by distance when a location filter is set
  const sorted = filterLoc.latitude != null
    ? [...filtered].sort((a, b) => {
        const da = typeof a.distance_km === 'number' ? a.distance_km : Number.MAX_VALUE
        const db = typeof b.distance_km === 'number' ? b.distance_km : Number.MAX_VALUE
        return da - db
      })
    : filtered

  // Events shaped for the Leaflet map component
  const mapEvents: MapEvent[] = sorted.map(ev => ({
    id: ev.id,
    title: ev.title,
    latitude: ev.latitude ?? null,
    longitude: ev.longitude ?? null,
    starts_at: ev.date.toISOString(),
    city: ev.city ?? null,
    location_label: ev.location_label ?? null,
  }))

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
    <div style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui', paddingTop: 64, paddingBottom: 80 }}>
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
            <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.2rem)', fontWeight: 900, margin: '0 0 0.25rem', letterSpacing: '-0.5px' }}>🌍 Events</h1>
            <p style={{ color: '#64748b', margin: 0, fontSize: '0.9rem' }}>{sorted.length} upcoming event{sorted.length !== 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* List / Map view toggle */}
            <div style={{ display: 'flex', background: '#1e293b', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 10, overflow: 'hidden' }}>
              <button
                onClick={() => setView('list')}
                style={{
                  padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: view === 'list' ? '#38bdf8' : 'transparent',
                  color: view === 'list' ? '#0f172a' : '#94a3b8',
                  fontFamily: 'inherit',
                }}
              >📋 List</button>
              <button
                onClick={() => setView('map')}
                style={{
                  padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  background: view === 'map' ? '#38bdf8' : 'transparent',
                  color: view === 'map' ? '#0f172a' : '#94a3b8',
                  fontFamily: 'inherit',
                }}
              >🗺 Map</button>
            </div>
            <Link href="/events/create" className="ev-create-btn">
              + Create Event
            </Link>
          </div>
        </div>

        {/* Globalisation — location filter */}
        <div style={{ marginBottom: '0.9rem' }}>
          <LocationFilter
            location={filterLoc}
            onLocationChange={setFilterLoc}
            radiusKm={radiusKm}
            onRadiusChange={setRadiusKm}
            country={countryFilter}
            onCountryChange={setCountryFilter}
            countryOptions={countryOptions}
          />
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

        {/* Load error banner — visible whenever the events query failed,
            so schema drift / RLS / missing columns are surfaced instead
            of producing a silent "No events found" dead-end. */}
        {loadError && !loading && (
          <div
            role="alert"
            style={{
              background: 'rgba(248,113,113,0.08)',
              border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: 12,
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              color: '#fca5a5',
              fontSize: '0.85rem',
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.65rem',
            }}
          >
            <span style={{ flexShrink: 0, fontSize: '1.1rem' }}>⚠️</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, marginBottom: '0.2rem', color: '#f87171' }}>
                Couldn&rsquo;t load events
              </div>
              <div style={{ wordBreak: 'break-word' }}>{loadError}</div>
            </div>
          </div>
        )}

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
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📅</div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem', color: '#f1f5f9' }}>No events found</h2>
            <p style={{ color: '#64748b', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              {catFilter !== 'All' || modeFilter !== 'all' || priceFilter !== 'all' || timeFilter !== 'all' || filterLoc.latitude != null || countryFilter
                ? 'Try adjusting your filters — or be the first to create an event in this category.'
                : 'No upcoming events yet — why not create one?'}
            </p>
            <Link href="/events/create" style={{ display: 'inline-block', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.75rem 1.75rem', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem' }}>
              Create an Event →
            </Link>
          </div>
        ) : view === 'map' ? (
          <EventsMap
            events={mapEvents}
            height={520}
            center={filterLoc.latitude != null && filterLoc.longitude != null
              ? { lat: filterLoc.latitude, lng: filterLoc.longitude, zoom: 8 }
              : undefined}
          />
        ) : (
          <div className="ev-grid">
            {sorted.map(ev => (
              <EventCard key={ev.id} ev={ev} onRsvp={handleRsvp} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
