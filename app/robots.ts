import { MetadataRoute } from 'next'

// Canonical site URL — same fallback pattern as app/sitemap.ts and
// app/layout.tsx. NEXT_PUBLIC_BASE_URL from the Vercel environment,
// falling back to freetrust.co.
const BASE = process.env.NEXT_PUBLIC_BASE_URL || 'https://freetrust.co'

// Every path below this is private / server-side and should never
// be crawled. Kept as a single constant so all rule sets stay in sync.
const PRIVATE_PATHS = [
  '/dashboard',
  '/wallet',
  '/messages',
  '/admin',
  '/api/',
  '/settings',
  '/seller',
  '/orders',
  '/onboarding',
  '/notifications',
  '/profile/edit',
]

const PUBLIC_ALLOW = [
  '/',
  '/about',
  '/marketplace',
  '/services',
  '/products',
  '/jobs',
  '/events',
  '/community',
  '/communities',
  '/members',
  '/organisations',
  '/browse',
  '/articles',
  '/impact',
  '/feed',
  '/register',
  '/login',
  '/llms.txt',
]

// AI crawlers — explicitly allowed per the SEO audit. FreeTrust
// WANTS to appear in Perplexity / ChatGPT / Google SGE / Bing Chat
// answers, so we opt into every known AI user agent instead of
// relying on the default wildcard rule. Keep this list alphabetised
// so new entries don't get lost in a diff.
const AI_CRAWLERS = [
  'anthropic-ai',
  'Applebot-Extended',
  'Bingbot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'DuckAssistBot',
  'Google-Extended',
  'GoogleOther',
  'Googlebot',
  'GPTBot',
  'OAI-SearchBot',
  'PerplexityBot',
  'YouBot',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Default wildcard — public pages allowed, private disallowed
      {
        userAgent: '*',
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_PATHS,
      },
      // Explicit AI crawler rules — same allow/disallow as the
      // wildcard so they behave identically, but the explicit
      // entries signal intent and override any default disallow
      // some crawlers fall back to when a bot isn't listed.
      ...AI_CRAWLERS.map(userAgent => ({
        userAgent,
        allow: PUBLIC_ALLOW,
        disallow: PRIVATE_PATHS,
      })),
    ],
    sitemap: `${BASE}/sitemap.xml`,
  }
}
