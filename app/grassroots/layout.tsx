import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Grassroots',
  description: 'Find local hands-on work and everyday community help on FreeTrust — farming, trades, childcare, delivery, care, events help and more.',
  openGraph: {
    title: 'Grassroots | FreeTrust',
    description: 'Find local hands-on work and everyday community help on FreeTrust — farming, trades, childcare, delivery, care, events help and more.',
    url: `${BASE}/grassroots`,
    images: [{ url: `${BASE}/api/og?title=Grassroots&category=Local+Community`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grassroots | FreeTrust',
    description: 'Find local hands-on work and everyday community help on FreeTrust.',
  },
  alternates: { canonical: `${BASE}/grassroots` },
}

export default function GrassrootsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
