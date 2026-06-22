import type { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Experience Travel',
  description: 'Search flights, accommodation, and travel experiences through the FreeTrust travel marketplace.',
  openGraph: {
    title: 'Experience Travel | FreeTrust',
    description: 'Search flights, accommodation, and bundled travel options through FreeTrust.',
    url: `${BASE}/travel`,
    images: [{ url: `${BASE}/api/og?title=Experience+Travel&category=Travel`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Experience Travel | FreeTrust',
    description: 'Search flights, accommodation, and bundled travel options through FreeTrust.',
  },
  alternates: { canonical: `${BASE}/travel` },
}

export default function TravelLayout({ children }: { children: React.ReactNode }) {
  return children
}
