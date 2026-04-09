import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Member Directory',
  description: 'Browse the FreeTrust member directory — discover individuals, businesses and organisations. Filter by skills, location, trust level and more.',
  openGraph: {
    title: 'Member Directory | FreeTrust',
    description: 'Discover trusted members, professionals and businesses on FreeTrust.',
    url: 'https://freetrust.vercel.app/browse',
  },
  alternates: { canonical: 'https://freetrust.vercel.app/browse' },
}

export default function BrowseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
