import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Jobs Board',
  description: 'Find your next role on FreeTrust — remote, hybrid and on-site jobs. Full-time, part-time, contract and freelance across tech, design, marketing, trades and more.',
  openGraph: {
    title: 'Jobs Board | FreeTrust',
    description: 'Find trusted jobs and opportunities in the FreeTrust community.',
    url: `${BASE}/jobs`,
  },
  alternates: { canonical: `${BASE}/jobs` },
}

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
