import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Articles & Insights',
  description: 'Read articles, guides, and insights from the FreeTrust community. Learn about the community economy, Trust Coin, and building trust online.',
  openGraph: {
    title: 'Articles & Insights | FreeTrust',
    description: 'Read articles, guides, and insights from the FreeTrust community. Learn about the community economy, Trust Coin, and building trust online.',
    url: `${BASE}/articles`,
    images: [{ url: `${BASE}/api/og?title=Articles+%26+Insights&category=Community+Economy`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Articles & Insights | FreeTrust',
    description: 'Read articles, guides, and insights from the FreeTrust community. Learn about the community economy, Trust Coin, and building trust online.',
  },
  alternates: { canonical: `${BASE}/articles` },
}

export default function ArticlesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
