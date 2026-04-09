'use client'
import React, { useState, useEffect } from 'react'
import Link from 'next/link'

const taglines = [
  "Where trust is the currency.",
  "Buy, sell and connect with confidence.",
  "Earn reputation, unlock opportunities.",
  "Community-powered commerce.",
]

const features = [
  { icon: '🛒', title: 'Marketplace', desc: 'Browse services, products, and talent from verified members.', href: '/services' },
  { icon: '🌱', title: 'Impact Fund', desc: 'Every transaction contributes to sustainability projects worldwide.', href: '/impact' },
  { icon: '🤝', title: 'Communities', desc: 'Join purpose-driven groups and grow your network.', href: '/community' },
  { icon: '🗓️', title: 'Events', desc: 'Attend virtual and in-person events hosted by members.', href: '/events' },
  { icon: '📰', title: 'Articles', desc: 'Read and publish insights from the FreeTrust community.', href: '/articles' },
  { icon: '🏢', title: 'Organisations', desc: 'Discover and connect with values-aligned organisations.', href: '/organisations' },
]

const stats = [
  { value: '24,800+', label: 'Members' },
  { value: '6,200+', label: 'Services Listed' },
  { value: '£1.2M+', label: 'Impact Funded' },
  { value: '340+', label: 'Organisations' },
]

const S: Record<string, React.CSSProperties> = {
  page: { minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui' },
  hero: { background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(56,189,248,0.12) 0%, transparent 70%)', padding: '5rem 1.5rem 4rem', textAlign: 'center' },
  badge: { display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 999, padding: '0.3rem 1rem', fontSize: '0.8rem', color: '#38bdf8', marginBottom: '1.5rem', letterSpacing: '0.05em' },
  h1: { fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 1.5rem', letterSpacing: '-1px' },
  tagline: { fontSize: '1.2rem', color: '#94a3b8', marginBottom: '2.5rem', minHeight: '2rem', transition: 'opacity 0.5s' },
  ctaRow: { display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '4rem' },
  ctaPrimary: { background: '#38bdf8', color: '#0f172a', padding: '0.8rem 2rem', borderRadius: 8, fontWeight: 700, fontSize: '1rem', textDecoration: 'none', display: 'inline-block' },
  ctaSecondary: { background: 'transparent', color: '#cbd5e1', padding: '0.8rem 2rem', borderRadius: 8, fontWeight: 600, fontSize: '1rem', textDecoration: 'none', display: 'inline-block', border: '1px solid rgba(148,163,184,0.25)' },
  statsRow: { display: 'flex', gap: '2rem', justifyContent: 'center', flexWrap: 'wrap', padding: '3rem 1.5rem', borderTop: '1px solid rgba(56,189,248,0.08)', borderBottom: '1px solid rgba(56,189,248,0.08)' },
  statItem: { textAlign: 'center' },
  statVal: { fontSize: '2.2rem', fontWeight: 800, color: '#38bdf8', display: 'block' },
  statLabel: { fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' },
  section: { maxWidth: 1200, margin: '0 auto', padding: '4rem 1.5rem' },
  sectionTitle: { fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem', textAlign: 'center' },
  sectionSub: { color: '#64748b', textAlign: 'center', marginBottom: '2.5rem', fontSize: '1rem' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.25rem' },
  card: { background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.5rem', textDecoration: 'none', display: 'block', transition: 'all 0.2s' },
  cardIcon: { fontSize: '2rem', marginBottom: '0.75rem' },
  cardTitle: { fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '0.5rem' },
  cardDesc: { fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 },
  footer: { borderTop: '1px solid rgba(56,189,248,0.08)', padding: '2rem 1.5rem', textAlign: 'center', color: '#475569', fontSize: '0.85rem' },
}

export default function Home() {
  const [t, setT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setT(x => (x + 1) % taglines.length), 4000)
    return () => clearInterval(id)
  }, [])

  return (
    <main style={S.page}>
      {/* Hero */}
      <div style={S.hero}>
        <div style={S.badge}>TRUST-BASED SOCIAL COMMERCE</div>
        <h1 style={S.h1}>
          Free<span style={{ color: '#38bdf8' }}>Trust</span>
        </h1>
        <p style={S.tagline}>{taglines[t]}</p>
        <div style={S.ctaRow}>
          <Link href="/register" style={S.ctaPrimary}>Get Started Free</Link>
          <Link href="/services" style={S.ctaSecondary}>Browse Marketplace</Link>
        </div>
      </div>

      {/* Stats */}
      <div style={S.statsRow}>
        {stats.map(s => (
          <div key={s.label} style={S.statItem}>
            <span style={S.statVal}>{s.value}</span>
            <div style={S.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Features */}
      <div style={S.section}>
        <h2 style={S.sectionTitle}>Everything in one platform</h2>
        <p style={S.sectionSub}>FreeTrust brings together commerce, community, and impact under one roof.</p>
        <div style={S.grid}>
          {features.map(f => (
            <Link key={f.title} href={f.href} style={S.card}>
              <div style={S.cardIcon}>{f.icon}</div>
              <div style={S.cardTitle}>{f.title}</div>
              <p style={S.cardDesc}>{f.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* CTA Banner */}
      <div style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.12)', margin: '0 1.5rem 4rem', borderRadius: 16, padding: '3rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.75rem' }}>Ready to build trust?</h2>
        <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Join 24,800+ members already using FreeTrust to grow their businesses and communities.</p>
        <Link href="/register" style={S.ctaPrimary}>Create Free Account</Link>
      </div>

      <footer style={S.footer}>
        © 2025 FreeTrust · Built on trust, powered by community
      </footer>
    </main>
  )
}
