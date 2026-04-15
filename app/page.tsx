import type { Metadata } from 'next'
import HomeClient from '@/components/landing/HomeClient'
import { FAQ_ITEMS } from '@/lib/faq'

// ────────────────────────────────────────────────────────────────────────────
// Landing page — server component wrapper
// ────────────────────────────────────────────────────────────────────────────
// The interactive content (animated counters, featured services/products,
// live ticker, FAQ accordion) lives in components/landing/HomeClient.tsx
// as a client component. This server wrapper's job is to:
//
//   1. Export the generateMetadata / metadata so Next.js can build the
//      <head> — client components cannot export metadata, so the split
//      is necessary.
//   2. Render the JSON-LD <script type="application/ld+json"> tags for
//      AI search extractors (Organization, WebSite with SearchAction,
//      FAQPage from the shared FAQ_ITEMS constant).
//   3. Mount <HomeClient /> for the actual page body.

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'
const OG_IMAGE = `${BASE_URL}/og-image.png`

// Landing-page specific metadata. Overrides the layout-level default
// so the home page gets its own rich title + description tuned for
// AI search extraction (Perplexity, ChatGPT, Google SGE).
export const metadata: Metadata = {
  title: "FreeTrust — Ireland's Community Economy Marketplace | Earn & Spend TrustCoins",
  description:
    'FreeTrust is Ireland\'s community economy marketplace for freelancers, small businesses, community organisers, and nonprofits. Buy, sell, hire, host events — earn TrustCoins (₮) for every contribution.',
  keywords: [
    'FreeTrust',
    'community marketplace',
    'TrustCoins',
    'Ireland marketplace',
    'freelance services Ireland',
    'community economy',
    'social commerce',
    'sustainability fund',
    'Irish jobs board',
    'community events',
    'small business marketplace',
    'nonprofit directory',
  ],
  authors: [{ name: 'FreeTrust' }],
  alternates: { canonical: BASE_URL },
  openGraph: {
    type: 'website',
    locale: 'en_IE',
    url: BASE_URL,
    siteName: 'FreeTrust',
    title: "FreeTrust — Ireland's Community Economy Marketplace",
    description:
      'Buy, sell, hire, and collaborate on Ireland\'s community economy marketplace. Earn TrustCoins (₮) for every contribution. Built for freelancers, small businesses, community organisers, and nonprofits.',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'FreeTrust — Ireland\'s Community Economy Marketplace',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "FreeTrust — Ireland's Community Economy Marketplace",
    description:
      'Earn TrustCoins (₮) for every contribution. Ireland\'s community economy marketplace for freelancers, small businesses, and nonprofits.',
    images: [OG_IMAGE],
    creator: '@freetrust',
  },
}

// Organization schema — identifies FreeTrust as the publisher
const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'FreeTrust',
  alternateName: 'FreeTrust.co',
  url: BASE_URL,
  logo: `${BASE_URL}/icons/icon-512x512.png`,
  description:
    'Ireland\'s community economy marketplace where members buy, sell, hire, and collaborate. Every contribution earns TrustCoins (₮).',
  foundingDate: '2026',
  foundingLocation: {
    '@type': 'Place',
    name: 'Ireland',
    address: { '@type': 'PostalAddress', addressCountry: 'IE' },
  },
  areaServed: ['IE', 'GB', 'EU'],
  sameAs: [
    // Populate as real accounts appear
    `${BASE_URL}/about`,
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: 'support@freetrust.co',
    availableLanguage: ['en'],
  },
}

// WebSite schema — enables Google sitelinks searchbox on SERPs
const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'FreeTrust',
  url: BASE_URL,
  description:
    'Ireland\'s community economy marketplace. Earn TrustCoins (₮) for every contribution.',
  inLanguage: 'en-IE',
  publisher: { '@type': 'Organization', name: 'FreeTrust', url: BASE_URL },
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${BASE_URL}/browse?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
}

// FAQPage schema — by far the most impactful for AI search answers.
// Perplexity, ChatGPT, Google SGE, and Bing Chat all preferentially
// extract FAQPage-tagged Q&A pairs as direct answers. Shape matches
// https://schema.org/FAQPage exactly; the answer text is taken verbatim
// from the shared FAQ_ITEMS constant so the UI accordion and the
// extracted answer stay in sync.
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map(item => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}

export default function HomePage() {
  return (
    <>
      {/* JSON-LD structured data — rendered as raw script tags so Next
          streams them to the HTML <head> equivalent (Next 14 App Router
          hoists these into the document head automatically). */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <HomeClient />
    </>
  )
}
