'use client'
import React, { useState } from 'react'
import Link from 'next/link'

const event = {
  id: 1,
  title: 'FreeTrust Founder Summit 2025',
  type: 'In Person',
  date: 'Thursday, 17 April 2025',
  time: '10:00 – 18:00 BST',
  location: 'The Brewery, Chiswell Street, London EC1Y 4SD',
  attendees: 340,
  capacity: 400,
  price: 0,
  free: true,
  category: 'Conference',
  organiser: 'FreeTrust',
  organiserAvatar: 'FT',
  organiserTrust: 94,
  organiserMembers: 12800,
  description: `Our flagship annual event bringing together 400 founders, investors and community builders for a day of talks, panels and networking.

Join us for a full day of inspiring keynotes, practical workshops, and meaningful connections. Whether you're a first-time founder or a serial entrepreneur, the FreeTrust Founder Summit is designed to accelerate your journey.

**What to expect:**
• Morning keynotes from top founders and investors
• Afternoon breakout workshops on fundraising, product, and growth
• Networking lunch and evening drinks reception
• Live pitch competition with £10,000 prize pool
• Exhibition area featuring 30+ ecosystem partners`,
  tags: ['Founders', 'Networking', 'Startup', 'Investment', 'Growth'],
  schedule: [
    { time: '09:00', title: 'Doors Open & Registration' },
    { time: '10:00', title: 'Opening Keynote: The Trusted Founder' },
    { time: '11:00', title: 'Panel: Building in Public' },
    { time: '12:30', title: 'Networking Lunch' },
    { time: '14:00', title: 'Workshop Breakouts (x4 tracks)' },
    { time: '16:00', title: 'Pitch Competition Finals' },
    { time: '17:00', title: 'Awards & Closing Remarks' },
    { time: '17:30', title: 'Drinks Reception' },
  ],
  speakers: [
    { name: 'Amara Diallo', role: 'Founder, GreenTech Africa', avatar: 'AD', grad: 'linear-gradient(135deg,#f472b6,#db2777)' },
    { name: 'James Okafor', role: 'Partner, Impact Ventures', avatar: 'JO', grad: 'linear-gradient(135deg,#34d399,#059669)' },
    { name: 'Priya Nair', role: 'CTO, ScaleSmart', avatar: 'PN', grad: 'linear-gradient(135deg,#a78bfa,#7c3aed)' },
    { name: 'Lena Fischer', role: 'Head of Design, Buildspace', avatar: 'LF', grad: 'linear-gradient(135deg,#fbbf24,#d97706)' },
  ],
}

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  inner: { maxWidth: 1100, margin: '0 auto', padding: '2rem 1.5rem' },
  backLink: { color: '#64748b', fontSize: '0.83rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', marginBottom: '1.5rem' },
  hero: { background: 'linear-gradient(180deg,rgba(56,189,248,0.08) 0%,transparent 100%)', borderBottom: '1px solid rgba(56,189,248,0.08)', padding: '2rem 1.5rem' },
  heroInner: { maxWidth: 1100, margin: '0 auto' },
  metaRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' },
  badge: { background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.75rem', color: '#38bdf8' },
  freeBadge: { background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.25)', borderRadius: 999, padding: '0.2rem 0.7rem', fontSize: '0.75rem', color: '#34d399' },
  heroTitle: { fontSize: '2rem', fontWeight: 800, marginBottom: '1rem', lineHeight: 1.2 },
  infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '1rem', marginTop: '1.5rem' },
  infoItem: { display: 'flex', gap: '0.5rem', alignItems: 'flex-start' },
  infoIcon: { fontSize: '1.1rem', marginTop: '0.1rem' },
  infoText: { fontSize: '0.83rem', color: '#94a3b8', lineHeight: 1.4 },
  infoLabel: { fontSize: '0.72rem', color: '#475569', marginBottom: '0.2rem' },
  layout: { display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem', alignItems: 'start' },
  main: {},
  section: { marginBottom: '2rem' },
  sectionTitle: { fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid rgba(56,189,248,0.08)' },
  description: { fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.75, whiteSpace: 'pre-wrap' },
  scheduleRow: { display: 'flex', gap: '1rem', padding: '0.75rem 0', borderBottom: '1px solid rgba(148,163,184,0.06)' },
  scheduleTime: { fontSize: '0.8rem', fontWeight: 600, color: '#38bdf8', minWidth: 50 },
  scheduleTitle: { fontSize: '0.85rem', color: '#cbd5e1' },
  speakerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: '1rem' },
  speakerCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 10, padding: '1rem', textAlign: 'center' },
  speakerAvatar: { width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 700, color: '#0f172a', margin: '0 auto 0.5rem' },
  speakerName: { fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9' },
  speakerRole: { fontSize: '0.72rem', color: '#64748b', marginTop: '0.2rem', lineHeight: 1.3 },
  tagRow: { display: 'flex', gap: '0.4rem', flexWrap: 'wrap' },
  tag: { background: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 999, padding: '0.2rem 0.6rem', fontSize: '0.75rem', color: '#64748b' },
  sidebar: { position: 'sticky', top: 78 },
  rsvpCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.15)', borderRadius: 14, padding: '1.5rem', marginBottom: '1rem' },
  priceTag: { fontSize: '1.8rem', fontWeight: 800, color: '#34d399', marginBottom: '0.25rem' },
  spotsLeft: { fontSize: '0.82rem', color: '#64748b', marginBottom: '1.25rem' },
  progressBar: { height: 6, background: 'rgba(56,189,248,0.1)', borderRadius: 99, overflow: 'hidden', marginBottom: '0.4rem' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg,#38bdf8,#0284c7)', borderRadius: 99 },
  rsvpBtn: { width: '100%', background: '#38bdf8', border: 'none', borderRadius: 10, padding: '0.85rem', fontSize: '1rem', fontWeight: 800, color: '#0f172a', cursor: 'pointer', marginTop: '1rem' },
  rsvpBtnDone: { width: '100%', background: 'rgba(52,211,153,0.15)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 10, padding: '0.85rem', fontSize: '1rem', fontWeight: 800, color: '#34d399', cursor: 'default', marginTop: '1rem' },
  organiserCard: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.08)', borderRadius: 14, padding: '1.25rem' },
  orgAvatar: { width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' },
  orgRow: { display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' },
  orgName: { fontSize: '0.9rem', fontWeight: 700 },
  orgStat: { fontSize: '0.75rem', color: '#64748b' },
  trustBadge: { background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.2)', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.75rem', color: '#38bdf8', marginLeft: 'auto' },
  rewardBanner: { background: 'linear-gradient(135deg,rgba(251,191,36,0.1),rgba(245,158,11,0.05))', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '1rem', marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' },
  rewardIcon: { fontSize: '1.5rem', marginTop: '0.1rem' },
  rewardText: { fontSize: '0.82rem', color: '#fbbf24', lineHeight: 1.5 },
  shareRow: { display: 'flex', gap: '0.5rem', marginTop: '0.75rem' },
  shareBtn: { flex: 1, background: 'rgba(148,163,184,0.07)', border: '1px solid rgba(148,163,184,0.12)', borderRadius: 8, padding: '0.5rem', fontSize: '0.75rem', color: '#94a3b8', cursor: 'pointer', textAlign: 'center' as const },
}

export default function EventDetailPage() {
  const [rsvpDone, setRsvpDone] = useState(false)
  const pct = Math.round((event.attendees / event.capacity) * 100)

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.heroInner}>
          <Link href="/events" style={S.backLink}>← Back to Events</Link>
          <div style={S.metaRow}>
            <span style={S.badge}>🏛️ {event.category}</span>
            <span style={S.badge}>{event.type === 'Online' ? '🌐' : '📍'} {event.type}</span>
            {event.free && <span style={S.freeBadge}>✓ Free Event</span>}
          </div>
          <h1 style={S.heroTitle}>{event.title}</h1>
          <div style={S.infoGrid}>
            <div style={S.infoItem}>
              <span style={S.infoIcon}>📅</span>
              <div>
                <div style={S.infoLabel}>Date</div>
                <div style={S.infoText}>{event.date}</div>
              </div>
            </div>
            <div style={S.infoItem}>
              <span style={S.infoIcon}>🕐</span>
              <div>
                <div style={S.infoLabel}>Time</div>
                <div style={S.infoText}>{event.time}</div>
              </div>
            </div>
            <div style={S.infoItem}>
              <span style={S.infoIcon}>📍</span>
              <div>
                <div style={S.infoLabel}>Location</div>
                <div style={S.infoText}>{event.location}</div>
              </div>
            </div>
            <div style={S.infoItem}>
              <span style={S.infoIcon}>👥</span>
              <div>
                <div style={S.infoLabel}>Attendees</div>
                <div style={S.infoText}>{event.attendees} / {event.capacity} registered</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={S.inner}>
        <div style={S.layout}>
          <main style={S.main}>
            <div style={S.section}>
              <div style={S.sectionTitle}>About this Event</div>
              <div style={S.description}>{event.description}</div>
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>Schedule</div>
              {event.schedule.map(item => (
                <div key={item.time} style={S.scheduleRow}>
                  <div style={S.scheduleTime}>{item.time}</div>
                  <div style={S.scheduleTitle}>{item.title}</div>
                </div>
              ))}
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>Speakers</div>
              <div style={S.speakerGrid}>
                {event.speakers.map(s => (
                  <div key={s.name} style={S.speakerCard}>
                    <div style={{ ...S.speakerAvatar, background: s.grad }}>{s.avatar}</div>
                    <div style={S.speakerName}>{s.name}</div>
                    <div style={S.speakerRole}>{s.role}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={S.section}>
              <div style={S.sectionTitle}>Tags</div>
              <div style={S.tagRow}>
                {event.tags.map(t => <span key={t} style={S.tag}>{t}</span>)}
              </div>
            </div>
          </main>

          <aside style={S.sidebar}>
            <div style={S.rsvpCard}>
              <div style={S.priceTag}>{event.free ? 'Free' : `£${event.price}`}</div>
              <div style={S.spotsLeft}>{event.capacity - event.attendees} spots remaining</div>
              <div style={S.progressBar}>
                <div style={{ ...S.progressFill, width: `${pct}%` }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: '#475569' }}>{pct}% full</div>

              {rsvpDone ? (
                <button style={S.rsvpBtnDone} disabled>✓ You&apos;re Registered!</button>
              ) : (
                <button style={S.rsvpBtn} onClick={() => setRsvpDone(true)}>
                  {event.free ? 'Register Free →' : `Book Ticket – £${event.price} →`}
                </button>
              )}

              {rsvpDone && (
                <div style={S.rewardBanner}>
                  <span style={S.rewardIcon}>₮</span>
                  <div style={S.rewardText}>
                    <strong>+₮5 Trust earned!</strong><br />
                    You&apos;ve been rewarded for engaging with the community.
                  </div>
                </div>
              )}

              <div style={S.shareRow}>
                <button style={S.shareBtn}>🔗 Share</button>
                <button style={S.shareBtn}>📅 Add to Cal</button>
                <button style={S.shareBtn}>🔖 Save</button>
              </div>
            </div>

            <div style={S.organiserCard}>
              <div style={S.sectionTitle}>Organiser</div>
              <div style={S.orgRow}>
                <div style={S.orgAvatar}>{event.organiserAvatar}</div>
                <div>
                  <div style={S.orgName}>{event.organiser}</div>
                  <div style={S.orgStat}>{event.organiserMembers.toLocaleString()} members</div>
                </div>
                <div style={S.trustBadge}>₮ {event.organiserTrust}</div>
              </div>
              <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                FreeTrust is a community platform connecting trusted founders, investors, and professionals.
              </p>
              <button style={{ ...S.shareBtn, width: '100%', padding: '0.5rem' }}>View Profile →</button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
