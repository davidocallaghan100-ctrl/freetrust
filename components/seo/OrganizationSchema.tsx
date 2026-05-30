import { JsonLd } from './JsonLd'

// Organization + WebSite JSON-LD injected from the root layout.
// Global positioning — no country-specific address.
export function OrganizationSchema() {
  const siteLinks = [
    { name: 'Services', url: 'https://freetrust.co/services' },
    { name: 'Products', url: 'https://freetrust.co/products' },
    { name: 'Jobs', url: 'https://freetrust.co/jobs' },
    { name: 'Events', url: 'https://freetrust.co/events' },
    { name: 'Communities', url: 'https://freetrust.co/communities' },
    { name: 'Articles', url: 'https://freetrust.co/articles' },
    { name: 'Impact', url: 'https://freetrust.co/impact' },
    { name: 'Trust & Safety', url: 'https://freetrust.co/safety' },
  ]

  const org = {
    '@context': 'https://schema.org',
    '@type': ['Organization', 'OnlineBusiness'],
    '@id': 'https://freetrust.co/#organization',
    name: 'FreeTrust',
    alternateName: ['FreeTrust.co', 'FreeTrust Community Economy'],
    url: 'https://freetrust.co',
    logo: 'https://freetrust.co/icons/icon-512x512.png',
    image: 'https://freetrust.co/icons/freetrust-share-logo-20260524.png',
    foundingDate: '2024',
    description: 'FreeTrust is the community economy marketplace built around Trust Coin (₮), verified member profiles, protected messaging, on-platform payments, listings, jobs, events, communities and reviews.',
    slogan: 'The community economy marketplace where trust is currency.',
    knowsAbout: [
      'Community economy',
      'Trust-based marketplace',
      'TrustCoin rewards',
      'Verified members',
      'Services marketplace',
      'Community jobs',
      'Community events',
      'Sustainability impact',
    ],
    sameAs: [
      'https://twitter.com/freetrust',
    ],
  }

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': 'https://freetrust.co/#website',
    name: 'FreeTrust',
    alternateName: 'FreeTrust.co',
    url: 'https://freetrust.co',
    publisher: { '@id': 'https://freetrust.co/#organization' },
    inLanguage: 'en',
    description: 'The community economy marketplace built around Trust Coin (₮), trusted listings, jobs, events, communities and protected payments.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://freetrust.co/browse?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  }

  const navigation = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': 'https://freetrust.co/#sitelinks',
    name: 'FreeTrust key pages',
    itemListElement: siteLinks.map((item, index) => ({
      '@type': 'SiteNavigationElement',
      position: index + 1,
      name: item.name,
      url: item.url,
    })),
  }

  return (
    <>
      <JsonLd data={org} />
      <JsonLd data={website} />
      <JsonLd data={navigation} />
    </>
  )
}
