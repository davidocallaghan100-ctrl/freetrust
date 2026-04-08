'use client'
import React, { useState } from 'react'
import Link from 'next/link'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

interface CalEvent {
  id: number
  title: string
  day: number
  month: number
  year: number
  type: string
  free: boolean
  color: string
}

const calEvents: CalEvent[] = [
  { id: 1, title: 'FreeTrust Founder Summit', day: 17, month: 3, year: 2025, type: 'Conference', free: true, color: '#38bdf8' },
  { id: 2, title: 'AI for Sustainable Business', day: 22, month: 3, year: 2025, type: 'Webinar', free: true, color: '#a78bfa' },
  { id: 3, title: 'UX Research Masterclass', day: 23, month: 3, year: 2025, type: 'Workshop', free: false, color: '#fbbf24' },
  { id: 4, title: 'African Founders Network Meetup', day: 25, month: 3, year: 2025, type: 'Meetup', free: false, color: '#f472b6' },
  { id: 5, title: 'Next.js & Supabase Deep Dive', day: 28, month: 3, year: 2025, type: 'Live Stream', free: true, color: '#34d399' },
  { id: 6, title: 'Impact Investing for Beginners', day: 1, month: 4, year: 2025, type: 'Webinar', free: true, color: '#a78bfa' },
  { id: 7, title: 'Community Leadership Summit', day: 5, month: 4, year: 2025, type: 'Conference', free: false, color: '#38bdf8' },
  { id: 8, title: 'No-Code Tools Workshop', day: 9, month: 4, year: 2025, type: 'Workshop', free: true, color: '#fbbf24' },
]

function getDaysInMonth(month: number, year: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(month: number, year: number) {
  // 0=Sun → convert to Mon-based (0=Mon)
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  hero: { background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', borderBottom: '1px solid rgba(56,189,248,0.08)', padding: '2rem 1.5rem' },
  heroInner: { maxWidth: 1100, margin: '0 auto' },
  heroTitle: { fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' },
  heroSub: { color: '#64748b', fontSize: '0.9rem' },
  navRow: { display: 'flex', gap: '0.5rem', marginTop: '1rem' },
  navLink: { padding: '0.35rem 0.8rem', borderRadius: 999, fontSize: '0.8rem', background: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.12)', color: '#94a3b8', textDecoration: 'none' },
  navLinkActive: { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontWeight: 700 },
  inner: { maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 280px', gap: '2rem', alignItems: 'start' },
  calCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 14, overflow: 'hidden' },
  calHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid rgba(56,189,248,0.08)' },
  monthTitle: { fontSize: '1.1rem', fontWeight: 700 },
  navBtn: { background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 7, padding: '0.35rem 0.75rem', color: '#94a3b8', cursor: 'pointer', fontSize: '0.9rem' },
  dayHeaders: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: 'rgba(56,189,248,0.04)', borderBottom: '1px solid rgba(56,189,248,0.06)' },
  dayHeader: { padding: '0.6rem', textAlign: 'center' as const, fontSize: '0.75rem', fontWeight: 600, color: '#475569' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' },
  cell: { minHeight: 80, borderRight: '1px solid rgba(56,189,248,0.05)', borderBottom: '1px solid rgba(56,189,248,0.05)', padding: '0.4rem' },
  cellNum: { fontSize: '0.78rem', color: '#64748b', marginBottom: '0.25rem' },
  cellNumToday: { fontSize: '0.78rem', background: '#38bdf8', color: '#0f172a', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, marginBottom: '0.25rem' },
  eventPill: { borderRadius: 4, padding: '0.15rem 0.3rem', fontSize: '0.65rem', fontWeight: 600, marginBottom: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, cursor: 'pointer' },
  emptyCell: { minHeight: 80, borderRight: '1px solid rgba(56,189,248,0.05)', borderBottom: '1px solid rgba(56,189,248,0.05)', background: 'rgba(15,23,42,0.4)' },
  sidebar: { position: 'sticky', top: 78, display: 'flex', flexDirection: 'column', gap: '1rem' },
  sideCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 12, padding: '1.25rem' },
  sideTitle: { fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' },
  eventRow: { display: 'flex', gap: '0.6rem', alignItems: 'flex-start', padding: '0.5rem 0', borderBottom: '1px solid rgba(56,189,248,0.05)' },
  eventDot: { width: 8, height: 8, borderRadius: '50%', marginTop: '0.3rem', flexShrink: 0 },
  eventTitle2: { fontSize: '0.8rem', color: '#f1f5f9', fontWeight: 500 },
  eventMeta2: { fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' },
  hostBtn: { width: '100%', background: '#38bdf8', border: 'none', borderRadius: 9, padding: '0.65rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' },
}

export default function EventsCalendarPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth()) // 0-indexed
  const [year, setYear] = useState(now.getFullYear())

  const daysInMonth = getDaysInMonth(month, year)
  const firstDay = getFirstDayOfMonth(month, year)
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7

  const eventsThisMonth = calEvents.filter(e => e.month === month && e.year === year)

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.heroInner}>
          <h1 style={S.heroTitle}>Events Calendar</h1>
          <p style={S.heroSub}>Browse upcoming FreeTrust events by date.</p>
          <div style={S.navRow}>
            <Link href="/events" style={S.navLink}>List View</Link>
            <span style={{ ...S.navLink, ...S.navLinkActive }}>📅 Calendar</span>
            <Link href="/events/create" style={S.navLink}>+ Host an Event</Link>
          </div>
        </div>
      </div>

      <div style={S.inner}>
        <div>
          <div style={S.calCard}>
            <div style={S.calHeader}>
              <button style={S.navBtn} onClick={prevMonth}>‹</button>
              <div style={S.monthTitle}>{MONTHS[month]} {year}</div>
              <button style={S.navBtn} onClick={nextMonth}>›</button>
            </div>

            <div style={S.dayHeaders}>
              {DAYS.map(d => <div key={d} style={S.dayHeader}>{d}</div>)}
            </div>

            <div style={S.grid}>
              {Array.from({ length: totalCells }).map((_, idx) => {
                const dayNum = idx - firstDay + 1
                const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth
                const isToday = isCurrentMonth && dayNum === now.getDate() && month === now.getMonth() && year === now.getFullYear()
                const dayEvents = calEvents.filter(e => e.day === dayNum && e.month === month && e.year === year)

                if (!isCurrentMonth) return <div key={idx} style={S.emptyCell} />
                return (
                  <div key={idx} style={S.cell}>
                    {isToday
                      ? <div style={S.cellNumToday}>{dayNum}</div>
                      : <div style={S.cellNum}>{dayNum}</div>
                    }
                    {dayEvents.map(ev => (
                      <div key={ev.id} style={{ ...S.eventPill, background: ev.color + '20', color: ev.color }}>
                        {ev.title}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <aside style={S.sidebar}>
          <div style={S.sideCard}>
            <div style={S.sideTitle}>Events This Month</div>
            {eventsThisMonth.length === 0 && <p style={{ fontSize: '0.82rem', color: '#64748b' }}>No events this month.</p>}
            {eventsThisMonth.map(ev => (
              <div key={ev.id} style={S.eventRow}>
                <div style={{ ...S.eventDot, background: ev.color }} />
                <div>
                  <div style={S.eventTitle2}>{ev.title}</div>
                  <div style={S.eventMeta2}>Apr {ev.day} · {ev.type} · {ev.free ? 'Free' : 'Paid'}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...S.sideCard, background: 'rgba(56,189,248,0.04)', border: '1px solid rgba(56,189,248,0.12)' }}>
            <div style={S.sideTitle}>Host Your Own Event</div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, marginBottom: '0.75rem' }}>
              Earn ₮15 Trust Tokens when you host a community event.
            </p>
            <Link href="/events/create">
              <button style={S.hostBtn}>Create Event →</button>
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
