import { MetadataRoute } from 'next'

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
    sitemap: 'https://freetrust.vercel.app/sitemap.xml',
  }
}
