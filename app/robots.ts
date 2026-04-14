import { MetadataRoute } from 'next'

// Canonical site URL — same fallback pattern as app/sitemap.ts and
// app/layout.tsx. NEXT_PUBLIC_BASE_URL from the Vercel environment,
// falling back to freetrust.co. Previously hardcoded to the
// freetrust.vercel.app preview subdomain.
const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/services', '/products', '/jobs', '/events', '/browse', '/articles', '/community'],
        disallow: [
          '/dashboard',
          '/wallet',
          '/messages',
          '/admin',
          '/api/',
          '/settings',
          '/seller',
          '/orders',
          '/onboarding',
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: ['/'],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
