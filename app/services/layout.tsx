import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Services Marketplace',
  description: 'Find freelance services and skilled professionals on FreeTrust. Web development, design, marketing, writing, and more — online and local services.',
  openGraph: {
    title: 'Services Marketplace | FreeTrust',
    description: 'Find trusted freelancers and service providers. Browse 27 categories of online and local services.',
    url: 'https://freetrust.vercel.app/services',
  },
  alternates: { canonical: 'https://freetrust.vercel.app/services' },
}

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
