import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Community Events',
  description: 'Discover and host community events on FreeTrust. Connect with members, share skills, and grow the community economy together.',
  openGraph: {
    title: 'Community Events | FreeTrust',
    description: 'Discover and host community events on FreeTrust. Connect with members, share skills, and grow the community economy together.',
    url: `${BASE}/events`,
    images: [{ url: `${BASE}/api/og?title=Community+Events&category=Events`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Community Events | FreeTrust',
    description: 'Discover and host community events on FreeTrust. Connect with members, share skills, and grow the community economy together.',
  },
  alternates: { canonical: `${BASE}/events` },
}

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
