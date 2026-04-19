import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Services Marketplace',
  description: "Browse thousands of services on FreeTrust's trust-based marketplace. Hire verified community members for online and local services worldwide.",
  openGraph: {
    title: 'Services Marketplace | FreeTrust',
    description: "Browse thousands of services on FreeTrust's trust-based marketplace. Hire verified community members for online and local services worldwide.",
    url: `${BASE}/services`,
    images: [{ url: `${BASE}/api/og?title=Services+Marketplace&category=Community+Economy`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Services Marketplace | FreeTrust',
    description: "Browse thousands of services on FreeTrust's trust-based marketplace. Hire verified community members for online and local services worldwide.",
  },
  alternates: { canonical: `${BASE}/services` },
}

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
