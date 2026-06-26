import type { Metadata } from 'next'
import HomeClient from '@/components/marketing/HomeClient'
import { FAQS } from '@/lib/faq'
import { createClient } from '@/lib/supabase/server'

// Always fetch fresh counts on every request so the hero shows the real
// community size. The root layout does not set per-route revalidate so
// we force it here — the landing page is the single most important SEO
// surface and stale counts there hurt both users and crawlers.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'
const SHARE_IMAGE = `${BASE_URL}/icons/freetrust-share-logo-20260524.png`

// ── Metadata ──────────────────────────────────────────────────────────────────
// Overrides the site-wide defaults from app/layout.tsx specifically for
// the landing page. Title + description are the ones surfaced by Google
// / Bing / ChatGPT / Perplexity / Claude search results when someone
// queries "FreeTrust" or related terms.
export const metadata: Metadata = {
  title:       "FreeTrust — The Community Economy Marketplace | Earn & Spend TrustCoins",
  description: "Join FreeTrust — the secure community economy marketplace. Verified members, protected messaging, on-platform payments, TrustCoins, listings, jobs, events and reviews.",
  alternates:  { canonical: BASE_URL },
  openGraph: {
    type:        'website',
    url:         BASE_URL,
    siteName:    'FreeTrust',
    title:       "FreeTrust — The Community Economy Marketplace | Earn & Spend TrustCoins",
    description: "Join FreeTrust — the secure community economy marketplace. Verified members, protected messaging, on-platform payments, TrustCoins, listings, jobs, events and reviews.",
    images: [
      {
        url:    SHARE_IMAGE,
        width:  512,
        height: 512,
        type:   'image/png',
        alt:    "FreeTrust logo",
      },
    ],
  },
  twitter: {
    card:        'summary_large_image',
    title:       "FreeTrust — The Community Economy Marketplace | Earn & Spend TrustCoins",
    description: "Join FreeTrust — the secure community economy marketplace with verified members, protected messaging and on-platform payments.",
    images:      [SHARE_IMAGE],
    creator:     '@freetrust',
  },
}

// ── Server-side live count fetch ─────────────────────────────────────────────
// Returns the three counts the hero displays. Wrapped in try/catch so a
// Supabase outage falls back to zeros instead of crashing the homepage —
// the user experience degrades to "0 members · 0 listings · 0 communities"
// but the page still renders fully.
async function getLandingCounts() {
  const fallback = { members: 0, listings: 0, communities: 0 }
  try {
    const supabase = await createClient()
    const [profilesRes, listingsRes, communitiesRes] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('listings').select('id', { count: 'exact', head: true }),
      supabase.from('communities').select('id', { count: 'exact', head: true }),
    ])
    return {
      members:     profilesRes.count    ?? 0,
      listings:    listingsRes.count    ?? 0,
      communities: communitiesRes.count ?? 0,
    }
  } catch (err) {
    console.error('[app/page.tsx] getLandingCounts failed:', err)
    return fallback
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function Page() {
  const counts = await getLandingCounts()

  // JSON-LD payloads — rendered into the initial HTML so Google, Bing,
  // ChatGPT, Perplexity and Claude can index them without running JS.
  //
  //   1. Organization   — who we are (name, URL, description)
  //   2. WebSite        — sitelinks search box target for search results
  //   3. FAQPage        — most important for AI search (ChatGPT / SGE /
  //                       Perplexity lift FAQPage entries directly when
  //                       answering questions about FreeTrust)
  //
  // The FAQ data is pulled from lib/faq.ts, the single source of truth
  // — the displayed accordion and the JSON-LD can never drift apart.
  const organizationLd = {
    '@context':        'https://schema.org',
    '@type':           ['Organization', 'OnlineBusiness'],
    '@id':             `${BASE_URL}/#organization`,
    name:              'FreeTrust',
    alternateName:     ['FreeTrust.co', 'FreeTrust Community Economy'],
    url:               BASE_URL,
    description:       "FreeTrust is the community economy marketplace where trust is currency — verified members, protected messaging, on-platform payments, TrustCoins, listings, jobs, events, articles and communities.",
    logo:              `${BASE_URL}/icons/icon-512x512.png`,
    image:             `${BASE_URL}/icons/freetrust-share-logo-20260524.png`,
    slogan:            'The community economy marketplace where trust is currency.',
    sameAs: [
      'https://www.linkedin.com/company/freetrust/',
      'https://www.instagram.com/freetrust.co',
      'https://twitter.com/freetrust',
    ],
  }

  const websiteLd = {
    '@context':   'https://schema.org',
    '@type':      'WebSite',
    '@id':        `${BASE_URL}/#website`,
    name:         'FreeTrust',
    url:          BASE_URL,
    publisher:    { '@id': `${BASE_URL}/#organization` },
    description:  "The community economy marketplace for trusted services, products, jobs, events, articles and communities.",
    inLanguage:   'en',
    potentialAction: {
      '@type':       'SearchAction',
      target:        `${BASE_URL}/browse?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  const faqLd = {
    '@context':   'https://schema.org',
    '@type':      'FAQPage',
    mainEntity:   FAQS.map(item => ({
      '@type':         'Question',
      name:            item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text:    item.answer,
      },
    })),
  }

  return (
    <>
      {/* JSON-LD structured data — inlined so it's in the server-
          rendered HTML. Using three separate script tags (not a
          @graph array) keeps each payload independently parseable
          by simpler crawlers that don't handle @graph correctly. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <HomeClient initialCounts={counts} />
    </>
  )
}
