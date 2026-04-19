import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Community Impact',
  description: "Track and support real-world impact through FreeTrust's community economy. Donate, vote, and invest in causes that matter.",
  openGraph: {
    title: 'Community Impact | FreeTrust',
    description: "Track and support real-world impact through FreeTrust's community economy. Donate, vote, and invest in causes that matter.",
    url: `${BASE}/impact`,
    images: [{ url: `${BASE}/api/og?title=Community+Impact&category=Impact`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Community Impact | FreeTrust',
    description: "Track and support real-world impact through FreeTrust's community economy. Donate, vote, and invest in causes that matter.",
  },
  alternates: { canonical: `${BASE}/impact` },
}

export default function ImpactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
