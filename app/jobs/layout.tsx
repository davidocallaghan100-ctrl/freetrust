import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Community Jobs Board',
  description: "Find jobs and hire talent on FreeTrust's community jobs board. Earn Trust Coins (₮) and build your reputation in the global community economy.",
  openGraph: {
    title: 'Community Jobs Board | FreeTrust',
    description: "Find jobs and hire talent on FreeTrust's community jobs board. Earn Trust Coins (₮) and build your reputation in the global community economy.",
    url: `${BASE}/jobs`,
    images: [{ url: `${BASE}/api/og?title=Community+Jobs+Board&category=Jobs`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Community Jobs Board | FreeTrust',
    description: "Find jobs and hire talent on FreeTrust's community jobs board. Earn Trust Coins (₮) and build your reputation in the global community economy.",
  },
  alternates: { canonical: `${BASE}/jobs` },
}

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
