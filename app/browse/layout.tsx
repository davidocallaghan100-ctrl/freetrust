import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Member Directory',
  description: 'Browse the FreeTrust member directory — discover individuals, businesses and organisations. Filter by skills, location, trust level and more.',
  openGraph: {
    title: 'Member Directory | FreeTrust',
    description: 'Discover trusted members, professionals and businesses on FreeTrust.',
    url: `${BASE}/browse`,
  },
  alternates: { canonical: `${BASE}/browse` },
}

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
