import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Gig Economy',
  description: 'Manage your gigs, track performance, handle disputes and payments on FreeTrust.',
}

export default function GigEconomyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
