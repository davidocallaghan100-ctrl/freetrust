import type { Metadata } from 'next'
import Link from 'next/link'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'About FreeTrust — Community Economy Marketplace',
  description:
    'Learn what FreeTrust is: a community economy marketplace for trusted services, products, jobs, events, articles, communities and TrustCoin rewards.',
  alternates: { canonical: `${BASE}/about` },
  openGraph: {
    title: 'About FreeTrust — Community Economy Marketplace',
    description:
      'FreeTrust is a community economy marketplace where trust is currency: verified members, protected messaging, on-platform payments and TrustCoin rewards.',
    url: `${BASE}/about`,
    type: 'website',
    images: [{ url: `${BASE}/icons/freetrust-share-logo-20260524.png`, width: 512, height: 512, alt: 'FreeTrust logo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About FreeTrust — Community Economy Marketplace',
    description: 'The community economy marketplace where trust is currency.',
    images: [`${BASE}/icons/freetrust-share-logo-20260524.png`],
  },
}

const sections = [
  ['Marketplace', 'Buy, sell and discover services and products from trusted members.'],
  ['Jobs', 'Post and find community-first opportunities.'],
  ['Events', 'Create and discover local, online and impact-focused events.'],
  ['Communities', 'Build groups around shared interests, places and missions.'],
  ['TrustCoins', 'Earn ₮ for useful contributions and spend them on visibility, badges and community impact.'],
  ['Safety', 'Use protected messaging, on-platform payments and member verification signals.'],
]

export default function AboutPage() {
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'What is FreeTrust?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'FreeTrust is a community economy marketplace for trusted services, products, jobs, events, articles and communities, built around TrustCoin rewards and protected on-platform interactions.',
        },
      },
      {
        '@type': 'Question',
        name: 'Who is FreeTrust for?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'FreeTrust is for freelancers, small businesses, community organisers, nonprofits, social enterprises and people who want to build trust through useful contribution.',
        },
      },
      {
        '@type': 'Question',
        name: 'What are TrustCoins?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'TrustCoins (₮) are FreeTrust reputation and contribution rewards. Members earn them for constructive activity such as creating listings, publishing articles, completing orders, creating communities and leaving reviews.',
        },
      },
    ],
  }

  return (
    <main id="main-content" style={{ minHeight: '100vh', padding: '96px 20px 48px', background: 'var(--ft-bg)', color: '#f8fafc' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <section style={{ maxWidth: 980, margin: '0 auto' }}>
        <p style={{ color: 'var(--ft-accent)', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 12 }}>About FreeTrust</p>
        <h1 style={{ fontSize: 'clamp(2.25rem, 7vw, 4.8rem)', lineHeight: 0.95, letterSpacing: '-0.06em', margin: '12px 0 18px' }}>
          The community economy marketplace where trust is currency.
        </h1>
        <p style={{ maxWidth: 760, color: 'var(--ft-text-secondary)', fontSize: '1.08rem', lineHeight: 1.7 }}>
          FreeTrust helps members discover trusted services, products, jobs, events, articles and communities while building reputation through TrustCoins (₮), verified profiles, protected messaging and on-platform payments.
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 26 }}>
          <Link href="/register" style={{ background: 'linear-gradient(135deg,var(--ft-accent),#0284c7)', color: '#fff', padding: '0.85rem 1.3rem', borderRadius: 12, fontWeight: 800, textDecoration: 'none' }}>Join FreeTrust</Link>
          <Link href="/marketplace" style={{ border: '1px solid rgba(148,163,184,0.24)', color: 'var(--ft-text-secondary)', padding: '0.85rem 1.3rem', borderRadius: 12, fontWeight: 750, textDecoration: 'none' }}>Explore marketplace</Link>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 14, marginTop: 42 }}>
          {sections.map(([title, body]) => (
            <article key={title} style={{ background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 18, padding: 20 }}>
              <h2 style={{ margin: '0 0 8px', fontSize: '1.05rem' }}>{title}</h2>
              <p style={{ margin: 0, color: 'var(--ft-text-secondary)', lineHeight: 1.6, fontSize: '0.94rem' }}>{body}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  )
}
