import type { Metadata } from 'next'
import Link from 'next/link'
import { FAQ_ITEMS } from '@/lib/faq'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'About FreeTrust — Our Mission, Story, and Values',
  description:
    'FreeTrust is Ireland\'s community economy marketplace. We\'re building a platform where trust is currency — rewarding contribution over clicks, and funding real-world impact projects with every transaction.',
  alternates: { canonical: `${BASE_URL}/about` },
  openGraph: {
    title: 'About FreeTrust',
    description:
      'Ireland\'s community economy marketplace. Built on trust, contribution, and real-world impact.',
    url: `${BASE_URL}/about`,
    siteName: 'FreeTrust',
    type: 'website',
  },
}

// AboutPage JSON-LD — gives AI search engines a clean structured
// definition of the platform + mission. Complements the home-page
// FAQPage schema for AI extractor coverage.
const aboutJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'AboutPage',
  mainEntity: {
    '@type': 'Organization',
    name: 'FreeTrust',
    url: BASE_URL,
    description:
      'Ireland\'s community economy marketplace where members buy, sell, hire, and collaborate — earning TrustCoins for every contribution.',
    foundingDate: '2026',
    foundingLocation: {
      '@type': 'Place',
      name: 'Ireland',
      address: { '@type': 'PostalAddress', addressCountry: 'IE' },
    },
  },
}

const SECTION = {
  maxWidth: 820,
  margin: '0 auto',
  padding: '0 1.25rem',
}

export default function AboutPage() {
  return (
    <main style={{ minHeight: 'calc(100vh - 58px)', background: '#0f172a', color: '#f1f5f9', fontFamily: 'system-ui, sans-serif' }}>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutJsonLd) }}
      />

      {/* Hero */}
      <header style={{ background: 'radial-gradient(ellipse 100% 80% at 50% -5%, rgba(56,189,248,0.13) 0%, transparent 65%)', borderBottom: '1px solid rgba(56,189,248,0.08)', padding: '4rem 1.25rem 3rem' }}>
        <div style={SECTION}>
          <div style={{ display: 'inline-block', background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 999, padding: '0.3rem 1rem', fontSize: '0.72rem', color: '#38bdf8', letterSpacing: '0.06em', fontWeight: 700, marginBottom: '1.25rem' }}>
            ABOUT FREETRUST
          </div>
          <h1 style={{ fontSize: 'clamp(2rem,5vw,3.3rem)', fontWeight: 900, margin: '0 0 1rem', letterSpacing: '-1.2px', lineHeight: 1.1 }}>
            A community economy, <br />
            <span style={{ background: 'linear-gradient(135deg,#38bdf8,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              built on trust
            </span>
          </h1>
          <p style={{ fontSize: '1.1rem', color: '#cbd5e1', lineHeight: 1.7, margin: 0, maxWidth: 680 }}>
            FreeTrust is Ireland&apos;s community economy marketplace. We&apos;re building a platform where trust is currency — where every contribution to the community is rewarded with real, portable reputation, and where 1% of every transaction funds real-world impact projects chosen by members.
          </p>
        </div>
      </header>

      {/* Mission */}
      <section style={{ padding: '3.5rem 1.25rem', borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
        <div style={SECTION}>
          <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 900, margin: '0 0 1rem', letterSpacing: '-0.3px' }}>
            Our mission
          </h2>
          <p style={{ fontSize: '1rem', color: '#cbd5e1', lineHeight: 1.75, margin: '0 0 1rem' }}>
            The internet&apos;s marketplaces reward attention, not contribution. The loudest seller, the flashiest ad, the biggest budget — they win. Quiet, careful, community-minded work gets buried.
          </p>
          <p style={{ fontSize: '1rem', color: '#cbd5e1', lineHeight: 1.75, margin: '0 0 1rem' }}>
            We think that&apos;s backwards. Trust should compound. Good work should lower your fees, not raise your ad spend. Hosting an event, publishing a useful article, giving a genuine review — these should all earn something real.
          </p>
          <p style={{ fontSize: '1rem', color: '#cbd5e1', lineHeight: 1.75, margin: 0 }}>
            FreeTrust is our answer: one platform for the whole community economy — marketplace, jobs, events, communities, social feed, organisations directory — with a single reputation currency (TrustCoins, or ₮) that rewards real contribution and unlocks real benefits.
          </p>
        </div>
      </section>

      {/* Story */}
      <section style={{ padding: '3.5rem 1.25rem', borderBottom: '1px solid rgba(56,189,248,0.06)', background: 'rgba(56,189,248,0.02)' }}>
        <div style={SECTION}>
          <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 900, margin: '0 0 1rem', letterSpacing: '-0.3px' }}>
            Our story
          </h2>
          <p style={{ fontSize: '1rem', color: '#cbd5e1', lineHeight: 1.75, margin: '0 0 1rem' }}>
            FreeTrust was founded in 2026 in Ireland. We started because we&apos;d watched friends and neighbours build brilliant small businesses and community groups — only to get lost in the noise of algorithmic feeds and the friction of running five separate SaaS accounts.
          </p>
          <p style={{ fontSize: '1rem', color: '#cbd5e1', lineHeight: 1.75, margin: 0 }}>
            We&apos;re built in Ireland and optimised for the Irish community — but FreeTrust is open to members worldwide. Our Stripe Connect integration supports bank payouts across the EU and UK, and the marketplace ships internationally.
          </p>
        </div>
      </section>

      {/* Values */}
      <section style={{ padding: '3.5rem 1.25rem', borderBottom: '1px solid rgba(56,189,248,0.06)' }}>
        <div style={SECTION}>
          <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 900, margin: '0 0 1.5rem', letterSpacing: '-0.3px' }}>
            What we value
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
            {[
              { icon: '🙋', title: 'Real people', desc: 'Every member is a verified human. Zero tolerance for bots, fake profiles, or automated farming.' },
              { icon: '₮',  title: 'Trust compounds', desc: 'Contribution is rewarded. Higher Trust = lower fees and better visibility, no ad budget required.' },
              { icon: '🌱', title: 'Impact by default', desc: '1% of every transaction funds real-world community impact projects via the Sustainability Fund.' },
              { icon: '🇮🇪', title: 'Built for Ireland', desc: 'Optimised for the Irish community, open to the world. EU-first, GDPR-native.' },
            ].map(v => (
              <div key={v.title} style={{ background: '#1e293b', border: '1px solid rgba(56,189,248,0.1)', borderRadius: 12, padding: '1.25rem 1.1rem' }}>
                <div style={{ fontSize: '1.6rem', marginBottom: '0.4rem' }}>{v.icon}</div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f1f5f9', margin: '0 0 0.35rem' }}>{v.title}</h3>
                <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.55, margin: 0 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick FAQ links for SEO */}
      <section style={{ padding: '3rem 1.25rem' }}>
        <div style={SECTION}>
          <h2 style={{ fontSize: 'clamp(1.3rem,2.5vw,1.7rem)', fontWeight: 900, margin: '0 0 0.75rem', letterSpacing: '-0.3px' }}>
            Common questions
          </h2>
          <p style={{ color: '#64748b', margin: '0 0 1.5rem', fontSize: '0.92rem', lineHeight: 1.6 }}>
            Full answers are on the <Link href="/#faq" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>home page FAQ</Link>.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {FAQ_ITEMS.slice(0, 6).map(item => (
              <li key={item.question} style={{ fontSize: '0.92rem' }}>
                <Link href="/#faq" style={{ color: '#cbd5e1', textDecoration: 'none' }}>
                  → {item.question}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '3.5rem 1.25rem', background: 'linear-gradient(135deg, rgba(56,189,248,0.06), rgba(129,140,248,0.06))', borderTop: '1px solid rgba(56,189,248,0.1)' }}>
        <div style={{ ...SECTION, textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(1.5rem,3vw,2rem)', fontWeight: 900, margin: '0 0 0.75rem', letterSpacing: '-0.3px' }}>
            Ready to join?
          </h2>
          <p style={{ color: '#94a3b8', margin: '0 0 1.5rem', fontSize: '0.95rem', lineHeight: 1.6 }}>
            Free to sign up. ₮200 welcome bonus. No subscription.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/register" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#38bdf8,#0284c7)', color: '#fff', padding: '0.9rem 2rem', borderRadius: 10, fontWeight: 800, fontSize: '0.95rem', textDecoration: 'none', boxShadow: '0 4px 20px rgba(56,189,248,0.35)' }}>
              Join FreeTrust Free →
            </Link>
            <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1', padding: '0.9rem 1.75rem', borderRadius: 10, fontWeight: 600, fontSize: '0.95rem', textDecoration: 'none', border: '1px solid rgba(148,163,184,0.2)' }}>
              Back to home
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
