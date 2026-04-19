import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Organisations',
  description: 'Discover verified organisations on FreeTrust. Support community businesses, nonprofits, and member-owned enterprises in the trust economy.',
  openGraph: {
    title: 'Organisations | FreeTrust',
    description: 'Discover verified organisations on FreeTrust. Support community businesses, nonprofits, and member-owned enterprises in the trust economy.',
    url: `${BASE}/organisations`,
    images: [{ url: `${BASE}/api/og?title=Organisations&category=Community+Economy`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Organisations | FreeTrust',
    description: 'Discover verified organisations on FreeTrust. Support community businesses, nonprofits, and member-owned enterprises in the trust economy.',
  },
  alternates: { canonical: `${BASE}/organisations` },
}

export default function OrganisationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
