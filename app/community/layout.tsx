import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Communities',
  description: 'Join communities on FreeTrust and connect with like-minded members. Learn, collaborate, and earn Trust Coins in the community economy.',
  openGraph: {
    title: 'Communities | FreeTrust',
    description: 'Join communities on FreeTrust and connect with like-minded members. Learn, collaborate, and earn Trust Coins in the community economy.',
    url: `${BASE}/community`,
    images: [{ url: `${BASE}/api/og?title=Communities&category=Community`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Communities | FreeTrust',
    description: 'Join communities on FreeTrust and connect with like-minded members. Learn, collaborate, and earn Trust Coins in the community economy.',
  },
  alternates: { canonical: `${BASE}/community` },
}

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
