import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Services Marketplace',
  description: 'Find freelance services and skilled professionals on FreeTrust. Web development, design, marketing, writing, and more — online and local services.',
  openGraph: {
    title: 'Services Marketplace | FreeTrust',
    description: 'Find trusted freelancers and service providers. Browse 27 categories of online and local services.',
    url: `${BASE}/services`,
  },
  alternates: { canonical: `${BASE}/services` },
}

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
