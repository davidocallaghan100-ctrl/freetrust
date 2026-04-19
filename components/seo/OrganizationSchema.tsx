import { JsonLd } from './JsonLd'

// Organization + WebSite JSON-LD injected from the root layout.
// Global positioning — no country-specific address.
export function OrganizationSchema() {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'FreeTrust',
    url: 'https://freetrust.co',
    logo: 'https://freetrust.co/og-image.png',
    foundingDate: '2024',
    description: 'FreeTrust is the community economy marketplace built around Trust Coin (₮). Buy, sell, find jobs, and build trust — member-owned, community-first.',
    sameAs: [
      'https://twitter.com/freetrust',
    ],
  }

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'FreeTrust',
    url: 'https://freetrust.co',
    description: 'The community economy marketplace built around Trust Coin (₮).',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://freetrust.co/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <>
      <JsonLd data={org} />
      <JsonLd data={website} />
    </>
  )
}
