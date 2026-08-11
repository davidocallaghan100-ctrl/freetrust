import type { Metadata } from 'next'
import Link from 'next/link'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'FreeTrust Marketplace — Services, Products, Jobs & Events',
  description:
    'Explore the FreeTrust marketplace for trusted services, products, jobs, events, communities and articles from verified community members.',
  alternates: { canonical: `${BASE}/marketplace` },
  openGraph: {
    title: 'FreeTrust Marketplace — Services, Products, Jobs & Events',
    description: 'Browse trusted services, products, jobs, events and communities on FreeTrust.',
    url: `${BASE}/marketplace`,
    type: 'website',
    images: [{ url: `${BASE}/icons/freetrust-share-logo-20260524.png`, width: 512, height: 512, alt: 'FreeTrust logo' }],
  },
}

const links = [
  { title: 'Services', href: '/services', desc: 'Hire trusted members for local and online services.' },
  { title: 'Products', href: '/products', desc: 'Discover digital and physical products from FreeTrust sellers.' },
  { title: 'Jobs', href: '/jobs', desc: 'Find and post opportunities in the community economy.' },
  { title: 'Events', href: '/events', desc: 'Discover workshops, meetups and impact events.' },
  { title: 'Communities', href: '/communities', desc: 'Join groups organised around places, interests and missions.' },
  { title: 'Articles', href: '/articles', desc: 'Read community economy insights and member stories.' },
]

export default function MarketplacePage() {
  const collectionLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'FreeTrust Marketplace',
    url: `${BASE}/marketplace`,
    description: 'FreeTrust marketplace directory for services, products, jobs, events, communities and articles.',
    isPartOf: { '@id': `${BASE}/#website` },
    hasPart: links.map(link => ({ '@type': 'WebPage', name: link.title, url: `${BASE}${link.href}` })),
  }

  return (
    <main id="main-content" style={{ minHeight: '100vh', padding: '96px 20px 48px', background: 'var(--ft-bg)', color: '#f8fafc' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd) }} />
      <section style={{ maxWidth: 980, margin: '0 auto' }}>
        <p style={{ color: '#34d399', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: 12 }}>FreeTrust Marketplace</p>
        <h1 style={{ fontSize: 'clamp(2.1rem, 7vw, 4.6rem)', lineHeight: 0.98, letterSpacing: '-0.055em', margin: '12px 0 18px' }}>
          Services, products, jobs, events and communities in one trust-based marketplace.
        </h1>
        <p style={{ maxWidth: 760, color: 'var(--ft-text-secondary)', fontSize: '1.05rem', lineHeight: 1.7 }}>
          Explore the public FreeTrust discovery surfaces search engines can crawl: trusted listings, community jobs, events, groups, articles and member activity.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14, marginTop: 34 }}>
          {links.map(link => (
            <Link key={link.href} href={link.href} style={{ display: 'block', background: 'rgba(15,23,42,0.72)', border: '1px solid rgba(148,163,184,0.18)', borderRadius: 18, padding: 20, textDecoration: 'none' }}>
              <h2 style={{ color: '#f8fafc', margin: '0 0 8px', fontSize: '1.1rem' }}>{link.title}</h2>
              <p style={{ color: 'var(--ft-text-secondary)', margin: 0, lineHeight: 1.6, fontSize: '0.94rem' }}>{link.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
