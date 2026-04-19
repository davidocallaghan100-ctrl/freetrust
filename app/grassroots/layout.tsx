import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Grassroots Services',
  description: 'Find local grassroots services on FreeTrust — farming, trades, childcare, music lessons, driving instruction and more. Hire trusted community members near you.',
  openGraph: {
    title: 'Grassroots Services | FreeTrust',
    description: 'Find local grassroots services on FreeTrust — farming, trades, childcare, music lessons, driving instruction and more. Hire trusted community members near you.',
    url: `${BASE}/grassroots`,
    images: [{ url: `${BASE}/api/og?title=Grassroots+Services&category=Local+Community`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grassroots Services | FreeTrust',
    description: 'Find local grassroots services on FreeTrust — farming, trades, childcare, music lessons, driving instruction and more. Hire trusted community members near you.',
  },
  alternates: { canonical: `${BASE}/grassroots` },
}

export default function GrassrootsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
