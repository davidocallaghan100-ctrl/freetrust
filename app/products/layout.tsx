import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Product Marketplace',
  description: 'Discover digital downloads, templates, courses, physical goods and more on FreeTrust. Products made by trusted community members.',
  openGraph: {
    title: 'Product Marketplace | FreeTrust',
    description: 'Digital and physical products from trusted FreeTrust sellers.',
    url: 'https://freetrust.vercel.app/products',
  },
  alternates: { canonical: 'https://freetrust.vercel.app/products' },
}

export default function ProductsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
