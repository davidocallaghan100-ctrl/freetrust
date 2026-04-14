import { Metadata } from 'next'

const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export const metadata: Metadata = {
  title: 'Product Marketplace',
  description: 'Discover digital downloads, templates, courses, physical goods and more on FreeTrust. Products made by trusted community members.',
  openGraph: {
    title: 'Product Marketplace | FreeTrust',
    description: 'Digital and physical products from trusted FreeTrust sellers.',
    url: `${BASE}/products`,
  },
  alternates: { canonical: `${BASE}/products` },
}

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
