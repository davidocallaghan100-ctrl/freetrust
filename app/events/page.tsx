'use client'
import React, { useState } from 'react'

const filters = ['All Events', 'Online', 'In Person', 'Free', 'This Week', 'This Month']

const events = [
  {
    id: 1, title: 'FreeTrust Founder Summit 2025', type: 'In Person', date: 'Thu 17 Apr', time: '10:00 – 18:00',
    location: 'The Brewery, London', attendees: 340, capacity: 400, price: 0, free: true,
    category: 'Conference', organiser: 'FreeTrust', avatar: 'FT',
    desc: 'Our flagship annual event bringing together 400 founders, investors and community builders for a day of talks, panels and networking.',
    tags: ['Founders', 'Networking', 'Startup'],
  },
  {
    id: 2, title: 'AI for Sustainable Business', type: 'Online', date: 'Tue 22 Apr', time: '14:00 – 15:30',
    location: 'Zoom Webinar', attendees: 612, capacity: 1000, price: 0, free: true,
    category: 'Webinar', organiser: 'Amara Diallo', avatar: 'AD',
    desc: 'How AI tools can help small businesses measure and reduce their environmental footprint. Live demo + Q&A.',
    tags: ['AI', 'Sustainability', 'SME'],
  },
  {
    id: 3, title: 'UX Research Masterclass', type: 'Online', date: 'Wed 23 Apr', time: '11:00 – 13:00',
    location: 'Google Meet', attendees: 87, capacity: 120, price: 35, free: false,
    category: 'Workshop', organiser: 'Lena Fischer', avatar: 'LF',
    desc: 'Hands-on workshop covering user interviews, usability testing, and synthesising research into actionable insights.',
    tags: ['UX', 'Research', 'Design'],
  },
  {
    id: 4, title: 'African Founders Network Meetup', type: 'In Person', date: 'Fri 25 Apr', time: '18:00 – 21:00',
    location: 'Impact Hub, Manchester', attendees: 56, capacity: 80, price: 10, free: false,
    category: 'Meetup', organiser: 'Amara Diallo', avatar: 'AD',
    desc: 'Monthly in-person gathering of African diaspora founders in Manchester. Pitch practice + panel discussion.',
    tags: ['Founders', 'Diaspora', 'Community'],
  },
  {
    id: 5, title: 'Next.js & Supabase Deep Dive', type: 'Online', date: 'Mon 28 Apr', time: '19:00 – 20:30',
    location: 'YouTube Live', attendees: 234, capacity: 5000, price: 0, free: true,
    category: 'Live Stream', organiser: 'Priya Nair', avatar: 'PN',
    desc: 'Build a full-stack SaaS application from scratch using Next.js 14, Supabase, and Stripe. Recorded for later.',
    tags: ['Development', 'Next.js', 'SaaS'],
  },
  {
    id: 6, title: 'Impact Investing for Beginners', type: 'Online', date: 'Thu 1 May', time: '12:00 – 13:00',
    location: 'Zoom', attendees: 189, capacity: 300, price: 0, free: true,
    category: 'Webinar', organiser: 'James Okafor', avatar: 'JO',
    desc: 'Everything you need to know about investing in companies that generate social and environmental impact alongside financial returns.',
    tags: ['Investing', 'Impact', 'Finance'],
  },
]

const avatarGrad: Record<string, string> = {
  FT: 'linear-gradient(135deg,#38bdf8,#0284c7)',
  AD: 'linear-gradient(135deg,#f472b6,#db2777)',
  LF: 'linear-gradient(135deg,#fbbf24,#d97706)',
  PN: 'linear-gradient(135deg,#a78bfa,#7c3aed)',
  JO: 'linear-gradient(135deg,#34d399,#059669)',
}

const catIcon: Record<string, string> = {
  Conference: '🏛️', Webinar: '🖥️', Workshop: '🛠️', Meetup: '🤝', 'Live Stream': '📡',
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  hero: { background: 'linear-gradient(180deg,rgba(56,189,248,0.07) 0%,transparent 100%)', padding: '2.5rem 1.5rem 2rem', borderBottom: '1px solid rgba(56,189,248,0.08)' },
  inner: { maxWidth: 1200, margin: '0 auto' },
  filterRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1.25rem' },
  filterBtn: { padding: '0.35rem 0.9rem', borderRadius: 999, fontSize: '0.82rem', cursor: 'pointer', border: '1px solid rgba(148,163,184,0.2)', background: 'transparent', color: '#94a3b8', fontWeight: 500 },
  filterBtnActive: { background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', color: '#38bdf8', fontWeight: 700 },
  content: { maxWidth: 1200, margin: '0 auto', padding: '2rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr 280px', gap: '2rem', alignItems: 'start' },
  list: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem', display: 'flex', gap: '1.25rem' },
  dateBox: { minWidth: 70, background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0.75rem 0.5rem' },
  dateDay: { fontSize: '0.7rem', fontWeight: 600, color: '#38bdf8', letterSpacing: '0.05em' },
  dateNum: { fontSize: '1.8rem', fontWeight: 800, color: '#f1f5f9', lineHeight: 1 },
  dateMonth: { fontSize: '0.72rem', color: '#64748b', marginTop: '0.15rem' },
  cardBody: { flex: 1 },
  cardMeta: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' },
  catBadge: { background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', color: '#38bdf8' },
  typeBadge: { background: 'rgba(148,163,184,0.08)', border: '1px solid rgba(148,163,184,0.15)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', color: '#94a3b8' },
  freeBadge: { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', color: '#34d399' },
  cardTitle: { fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.4rem', color: '#f1f5f9' },
  cardDesc: { fontSize: '0.83rem', color: '#64748b', lineHeight: 1.55, marginBottom: '0.75rem' },
  cardFooter: { display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' },
  organiser: { display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#94a3b8' },
  orgAvatar: { width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700, color: '#0f172a' },
  attendees: { fontSize: '0.8rem', color: '#475569' },
  regBtn: { marginLeft: 'auto', background: '#38bdf8', border: 'none', borderRadius: 7, padding: '0.45rem 1.1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' },
  sidebar: { position: 'sticky', top: 78, display: 'flex', flexDirection: 'column', gap: '1.25rem' },
  sideCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem' },
  sideTitle: { fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f1f5f9' },
}

export default function EventsPage() {
  const [activeFilter, setActiveFilter] = useState(0)

  const filtered = (() => {
    if (activeFilter === 0) return events
    if (activeFilter === 1) return events.filter(e => e.type === 'Online')
    if (activeFilter === 2) return events.filter(e => e.type === 'In Person')
    if (activeFilter === 3) return events.filter(e => e.free)
    return events
  })()

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.inner}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Events</h1>
          <p style={{ color: '#64748b' }}>Discover and attend online and in-person events by FreeTrust members</p>
          <div style={S.filterRow}>
            {filters.map((f, i) => (
              <button key={f} onClick={() => setActiveFilter(i)} style={{ ...S.filterBtn, ...(activeFilter === i ? S.filterBtnActive : {}) }}>{f}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={S.content}>
        <div style={S.list}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.88rem', color: '#64748b' }}>{filtered.length} events</span>
            <button style={{ background: '#38bdf8', border: 'none', borderRadius: 7, padding: '0.4rem 1rem', fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>+ Host an Event</button>
          </div>

          {filtered.map(ev => {
            const [dayOfWeek, dayNum, month] = ev.date.split(' ')
            return (
              <div key={ev.id} style={S.card}>
                <div style={S.dateBox}>
                  <div style={S.dateDay}>{dayOfWeek.toUpperCase()}</div>
                  <div style={S.dateNum}>{dayNum}</div>
                  <div style={S.dateMonth}>{month}</div>
                </div>
                <div style={S.cardBody}>
                  <div style={S.cardMeta}>
                    <span style={S.catBadge}>{catIcon[ev.category]} {ev.category}</span>
                    <span style={S.typeBadge}>{ev.type === 'Online' ? '🌐' : '📍'} {ev.type}</span>
                    {ev.free && <span style={S.freeBadge}>Free</span>}
                    {!ev.free && <span style={{ ...S.catBadge, color: '#fbbf24', borderColor: 'rgba(251,191,36,0.25)', background: 'rgba(251,191,36,0.06)' }}>£{ev.price}</span>}
                  </div>
                  <div style={S.cardTitle}>{ev.title}</div>
                  <p style={S.cardDesc}>{ev.desc}</p>
                  <div style={S.cardFooter}>
                    <div style={S.organiser}>
                      <div style={{ ...S.orgAvatar, background: avatarGrad[ev.avatar] || '#38bdf8' }}>{ev.avatar}</div>
                      {ev.organiser}
                    </div>
                    <span style={S.attendees}>📍 {ev.location}</span>
                    <span style={S.attendees}>👥 {ev.attendees}/{ev.capacity}</span>
                    <span style={S.attendees}>🕐 {ev.time}</span>
                    <button style={S.regBtn}>{ev.free ? 'Register Free' : `Book – £${ev.price}`}</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Sidebar */}
        <aside style={S.sidebar}>
          <div style={S.sideCard}>
            <div style={S.sideTitle}>Upcoming This Week</div>
            {events.slice(0, 3).map(ev => (
              <div key={ev.id} style={{ paddingBottom: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f1f5f9' }}>{ev.title}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>{ev.date} · {ev.type}</div>
              </div>
            ))}
          </div>

          <div style={{ ...S.sideCard, background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.15)' }}>
            <div style={S.sideTitle}>Host Your Event</div>
            <p style={{ fontSize: '0.82rem', color: '#64748b', lineHeight: 1.5, marginBottom: '0.75rem' }}>Share your knowledge with the FreeTrust community. Online or in-person.</p>
            <button style={{ width: '100%', background: '#38bdf8', border: 'none', borderRadius: 8, padding: '0.6rem', fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', cursor: 'pointer' }}>Create Event</button>
          </div>

          <div style={S.sideCard}>
            <div style={S.sideTitle}>Stats</div>
            {[['128', 'Events this month'], ['8,200+', 'Registrations'], ['92%', 'Avg attendance rate']].map(([v, l]) => (
              <div key={l} style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8' }}>{v}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{l}</div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}
